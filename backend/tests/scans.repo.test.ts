import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  createSupabaseScansRepo,
  SCAN_IMAGES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  STORAGE_PAGE_SIZE,
  type NewScan,
} from '../src/repositories/scans.repo';
import { SupabaseOpError } from '../src/repositories/supabase';
import { classifySaved, USER_A } from './helpers/scansRepo';

type Call = [method: string, ...args: unknown[]];
type Result = { data?: unknown; error: { message: string; statusCode?: string } | null };

/**
 * Cliente de Supabase simulado: registra cada consulta como la cadena de métodos que la arma
 * (`from`, `select`, `eq`, …) y resuelve con el resultado configurado para esa tabla u operación.
 */
function fakeSupabase(results: Partial<Record<string, Result>> = {}) {
  const queries: Call[][] = [];
  const storage: Call[] = [];
  const take = (key: string): Result => results[key] ?? { data: [], error: null };

  function query(table: string) {
    const calls: Call[] = [['from', table]];
    queries.push(calls);
    const key = () => `${table}.${calls[1]?.[0] ?? 'select'}`;
    const builder: Record<string, unknown> = {
      then: (resolve: (r: Result) => void) => resolve(take(key())),
    };
    for (const method of ['select', 'insert', 'delete', 'eq', 'order', 'range', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      };
    }
    return builder;
  }

  const bucketApi = (bucket: string) => {
    const record =
      (method: string) =>
      async (...args: unknown[]) => {
        storage.push([method, bucket, ...args]);
        return take(`storage.${method}`);
      };
    return {
      upload: record('upload'),
      remove: record('remove'),
      createSignedUrls: record('createSignedUrls'),
    };
  };

  const client = { from: query, storage: { from: bucketApi } } as unknown as SupabaseClient;
  return { client: () => client, queries, storage };
}

const SCAN_ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';

const newScan = (overrides: Partial<NewScan> = {}): NewScan => ({
  id: SCAN_ID,
  userId: USER_A,
  objectName: 'Botella',
  materialCode: 'plastico',
  materialDetail: 'PET',
  confidence: 0.9,
  difficulty: null,
  saved: classifySaved,
  ideas: [],
  image: { bytes: Buffer.from('jpeg'), mimeType: 'image/jpeg' },
  ...overrides,
});

const filtersOf = (calls: Call[]) => calls.filter(([m]) => m === 'eq');

describe('createSupabaseScansRepo: toda consulta filtra por user_id', () => {
  it('list filtra por usuario y ordena por fecha e id (orden estable)', async () => {
    const fake = fakeSupabase();
    await createSupabaseScansRepo(fake.client).list(USER_A, { offset: 20, limit: 21 });

    expect(fake.queries).toHaveLength(1);
    const calls = fake.queries[0]!;
    expect(filtersOf(calls)).toEqual([['eq', 'user_id', USER_A]]);
    expect(calls.filter(([m]) => m === 'order')).toEqual([
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
    ]);
    expect(calls).toContainEqual(['range', 20, 40]);
  });

  it('findById filtra por usuario y por id', async () => {
    const fake = fakeSupabase({ 'scans.select': { data: null, error: null } });
    const found = await createSupabaseScansRepo(fake.client).findById(USER_A, SCAN_ID);

    expect(found).toBeNull();
    expect(filtersOf(fake.queries[0]!)).toEqual([
      ['eq', 'user_id', USER_A],
      ['eq', 'id', SCAN_ID],
    ]);
  });

  it('list marca en su posición la fila con resultado inválido, sin romper las demás', async () => {
    const row = (id: string, result: unknown) => ({
      id,
      created_at: '2026-10-20T12:00:00+00:00',
      object_name: 'Botella',
      image_path: null,
      result,
    });
    const ids = ['a', 'b', 'c'].map((c) => `0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6${c}`);
    const fake = fakeSupabase({
      'scans.select': {
        data: [
          row(ids[0]!, classifySaved),
          row(ids[1]!, { mode: 'otro' }),
          row(ids[2]!, classifySaved),
        ],
        error: null,
      },
    });

    const listed = await createSupabaseScansRepo(fake.client).list(USER_A, {
      offset: 0,
      limit: 21,
    });

    expect(listed.map((l) => (l.ok ? l.record.id : `inválida:${l.id}`))).toEqual([
      ids[0],
      `inválida:${ids[1]}`,
      ids[2],
    ]);
  });

  it('findById lanza si la fila tiene un resultado inválido', async () => {
    const fake = fakeSupabase({
      'scans.select': {
        data: { id: SCAN_ID, created_at: 'x', object_name: 'B', image_path: null, result: {} },
        error: null,
      },
    });
    await expect(createSupabaseScansRepo(fake.client).findById(USER_A, SCAN_ID)).rejects.toThrow();
  });

  it('findById convierte la fila al registro del historial', async () => {
    const row = {
      id: SCAN_ID,
      created_at: '2026-10-20T12:00:00.123456+00:00',
      object_name: 'Botella',
      image_path: `${USER_A}/${SCAN_ID}.jpg`,
      result: classifySaved,
    };
    const fake = fakeSupabase({ 'scans.select': { data: row, error: null } });

    expect(await createSupabaseScansRepo(fake.client).findById(USER_A, SCAN_ID)).toEqual({
      id: SCAN_ID,
      createdAt: row.created_at,
      objectName: 'Botella',
      imagePath: row.image_path,
      saved: classifySaved,
    });
  });

  it('save sube la imagen a la carpeta del usuario e inserta con su user_id', async () => {
    const fake = fakeSupabase();
    const ideas = [0, 1, 2].map((i) => ({
      id: `0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6${i}`,
      ideaIndex: i,
      title: `Idea ${i}`,
      description: 'd',
      extraMaterials: [],
    }));

    await createSupabaseScansRepo(fake.client).save(newScan({ ideas }));

    expect(fake.storage[0]).toEqual([
      'upload',
      SCAN_IMAGES_BUCKET,
      `${USER_A}/${SCAN_ID}.jpg`,
      Buffer.from('jpeg'),
      { contentType: 'image/jpeg', upsert: false },
    ]);
    const [scanInsert, ideasInsert] = fake.queries;
    expect(scanInsert?.[1]).toEqual([
      'insert',
      expect.objectContaining({ id: SCAN_ID, user_id: USER_A, result: classifySaved }),
    ]);
    expect(ideasInsert?.[0]).toEqual(['from', 'scan_ideas']);
    expect(ideasInsert?.[1]?.[1]).toHaveLength(3);
  });

  it('si insertar falla, borra lo hecho (filtrando por user_id) y lanza', async () => {
    const fake = fakeSupabase({ 'scan_ideas.insert': { error: { message: 'violación' } } });
    const ideas = [{ id: SCAN_ID, ideaIndex: 0, title: 't', description: 'd', extraMaterials: [] }];

    await expect(createSupabaseScansRepo(fake.client).save(newScan({ ideas }))).rejects.toThrow(
      'No se pudieron guardar las ideas: violación',
    );

    const cleanup = fake.queries[2]!;
    expect(cleanup[1]).toEqual(['delete']);
    expect(filtersOf(cleanup)).toEqual([
      ['eq', 'user_id', USER_A],
      ['eq', 'id', SCAN_ID],
    ]);
    expect(fake.storage[1]).toEqual(['remove', SCAN_IMAGES_BUCKET, [`${USER_A}/${SCAN_ID}.jpg`]]);
  });

  it('si la subida falla, no inserta nada', async () => {
    const fake = fakeSupabase({ 'storage.upload': { error: { message: 'cuota' } } });

    await expect(createSupabaseScansRepo(fake.client).save(newScan())).rejects.toThrow('cuota');
    expect(fake.queries).toHaveLength(0);
  });
});

describe('createSupabaseScansRepo.signImageUrls', () => {
  it('firma en lote con vida de 10 minutos', async () => {
    const fake = fakeSupabase({
      'storage.createSignedUrls': {
        data: [
          { path: 'a.jpg', signedUrl: 'https://s/a', error: null },
          { path: 'b.jpg', signedUrl: '', error: 'Object not found' },
        ],
        error: null,
      },
    });

    const urls = await createSupabaseScansRepo(fake.client).signImageUrls(['a.jpg', 'b.jpg']);

    expect(SIGNED_URL_TTL_SECONDS).toBe(600);
    expect(fake.storage).toEqual([
      ['createSignedUrls', SCAN_IMAGES_BUCKET, ['a.jpg', 'b.jpg'], 600],
    ]);
    expect(urls).toEqual(['https://s/a', null]);
  });

  it('sin rutas no llama a Storage', async () => {
    const fake = fakeSupabase();
    expect(await createSupabaseScansRepo(fake.client).signImageUrls([])).toEqual([]);
    expect(fake.storage).toHaveLength(0);
  });
});

describe('createSupabaseScansRepo: borrado (HU-14)', () => {
  it('deleteById filtra por usuario e id y devuelve la ruta de la imagen', async () => {
    const fake = fakeSupabase({
      'scans.delete': { data: { image_path: `${USER_A}/${SCAN_ID}.jpg` }, error: null },
    });

    const deleted = await createSupabaseScansRepo(fake.client).deleteById(USER_A, SCAN_ID);

    expect(deleted).toEqual({ imagePath: `${USER_A}/${SCAN_ID}.jpg` });
    const calls = fake.queries[0]!;
    expect(calls[1]).toEqual(['delete']);
    expect(filtersOf(calls)).toEqual([
      ['eq', 'user_id', USER_A],
      ['eq', 'id', SCAN_ID],
    ]);
  });

  it('deleteById sin fila (ajena o inexistente) devuelve null', async () => {
    const fake = fakeSupabase({ 'scans.delete': { data: null, error: null } });
    expect(await createSupabaseScansRepo(fake.client).deleteById(USER_A, SCAN_ID)).toBeNull();
  });

  it('deleteAll filtra por usuario y devuelve id e imagen de las filas borradas', async () => {
    const fake = fakeSupabase({
      'scans.delete': {
        data: [
          { id: SCAN_ID, image_path: `${USER_A}/${SCAN_ID}.jpg` },
          { id: 'otro', image_path: null },
        ],
        error: null,
      },
    });

    expect(await createSupabaseScansRepo(fake.client).deleteAll(USER_A)).toEqual([
      { id: SCAN_ID, imagePath: `${USER_A}/${SCAN_ID}.jpg` },
      { id: 'otro', imagePath: null },
    ]);
    const calls = fake.queries[0]!;
    expect(calls[1]).toEqual(['delete']);
    expect(filtersOf(calls)).toEqual([['eq', 'user_id', USER_A]]);
    expect(calls.at(-1)).toEqual(['select', 'id, image_path']);
  });

  it('deleteAll lanza si la base falla', async () => {
    const fake = fakeSupabase({ 'scans.delete': { error: { message: 'caída' } } });
    await expect(createSupabaseScansRepo(fake.client).deleteAll(USER_A)).rejects.toThrow('caída');
  });

  it('removeImages lanza si Storage falla y no llama sin rutas', async () => {
    // El mensaje de Storage puede citar la ruta (con el uuid): solo viaja el código.
    const fake = fakeSupabase({
      'storage.remove': { error: { message: `Falló ${USER_A}/a.jpg`, statusCode: '503' } },
    });
    const repo = createSupabaseScansRepo(fake.client);
    await repo.removeImages([]);
    expect(fake.storage).toHaveLength(0);
    const err: unknown = await repo.removeImages(['a.jpg']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SupabaseOpError);
    expect(err).toMatchObject({ code: '503' });
    expect(String(err)).not.toContain(USER_A);
  });
});

describe('createSupabaseScansRepo.listImagePaths (HU-22)', () => {
  /** Bucket con `total` archivos en la carpeta de Ana; `list` pagina por `offset` y `limit`. */
  function listingClient(
    total: number,
    error: { message: string; statusCode: string } | null = null,
  ) {
    const calls: unknown[][] = [];
    const names = Array.from({ length: total }, (_, i) => ({
      id: `obj-${i}`,
      name: `foto-${i}.jpg`,
    }));
    const list = async (folder: string, opts: { limit: number; offset: number }) => {
      calls.push([folder, opts.offset, opts.limit]);
      return error
        ? { data: null, error }
        : { data: names.slice(opts.offset, opts.offset + opts.limit), error: null };
    };
    const client = { storage: { from: () => ({ list }) } } as unknown as SupabaseClient;
    return { client: () => client, calls };
  }

  it('recorre todas las páginas de la carpeta del usuario', async () => {
    const fake = listingClient(STORAGE_PAGE_SIZE * 2 + 5);

    const paths = await createSupabaseScansRepo(fake.client).listImagePaths(USER_A);

    expect(paths).toHaveLength(STORAGE_PAGE_SIZE * 2 + 5);
    expect(paths[0]).toBe(`${USER_A}/foto-0.jpg`);
    expect(fake.calls).toEqual([
      [USER_A, 0, STORAGE_PAGE_SIZE],
      [USER_A, STORAGE_PAGE_SIZE, STORAGE_PAGE_SIZE],
      [USER_A, STORAGE_PAGE_SIZE * 2, STORAGE_PAGE_SIZE],
    ]);
  });

  it('ignora las subcarpetas (Storage las lista con `id: null`)', async () => {
    const list = async () => ({
      data: [
        { id: null, name: 'carpeta' },
        { id: 'obj-1', name: 'foto.jpg' },
      ],
      error: null,
    });
    const client = { storage: { from: () => ({ list }) } } as unknown as SupabaseClient;

    expect(await createSupabaseScansRepo(() => client).listImagePaths(USER_A)).toEqual([
      `${USER_A}/foto.jpg`,
    ]);
  });

  it('carpeta vacía: una sola consulta', async () => {
    const fake = listingClient(0);
    expect(await createSupabaseScansRepo(fake.client).listImagePaths(USER_A)).toEqual([]);
    expect(fake.calls).toHaveLength(1);
  });

  it('lanza si Storage falla', async () => {
    const fake = listingClient(3, { message: `Sin acceso a ${USER_A}/`, statusCode: '403' });
    const err: unknown = await createSupabaseScansRepo(fake.client)
      .listImagePaths(USER_A)
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: '403' });
    expect(String(err)).not.toContain(USER_A);
  });
});
