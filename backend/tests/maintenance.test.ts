import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMaintenanceRepo,
  IMAGE_PATH_QUERY_CHUNK,
  type MaintenanceRepo,
  type StoredImage,
} from '../src/repositories/maintenance.repo';
import { STORAGE_PAGE_SIZE } from '../src/repositories/scans.repo';
import { SupabaseOpError } from '../src/repositories/supabase';
import { runMaintenance, runMaintenanceCli } from '../src/services/maintenance.service';
import { USER_A } from './helpers/scansRepo';

// F5: imágenes huérfanas de `scan-images` y purga de `ai_usage` > 90 días, con Supabase simulado.

const NOW = new Date('2026-10-22T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

interface FakeState {
  /** carpeta → imágenes (rutas completas). */
  folders: Record<string, StoredImage[]>;
  scanPaths: Set<string>;
  aiUsage: Date[];
}

function fakeRepo(state: FakeState, overrides: Partial<MaintenanceRepo> = {}) {
  const repo = {
    listPage: vi.fn(async (folder: string, offset: number) => {
      const items =
        folder === ''
          ? Object.keys(state.folders).map((name) => ({ folder: name }))
          : (state.folders[folder] ?? []).map((image) => ({ image }));
      const page = items.slice(offset, offset + STORAGE_PAGE_SIZE);
      return {
        folders: page.flatMap((item) => ('folder' in item ? [item.folder] : [])),
        images: page.flatMap((item) => ('image' in item ? [item.image] : [])),
        done: page.length < STORAGE_PAGE_SIZE,
      };
    }),
    existingImagePaths: vi.fn(
      async (paths: string[]) => new Set(paths.filter((p) => state.scanPaths.has(p))),
    ),
    removeImages: vi.fn(async (_paths: string[]) => {}),
    countAiUsageBefore: vi.fn(
      async (cutoff: Date) => state.aiUsage.filter((d) => d.getTime() < cutoff.getTime()).length,
    ),
    deleteAiUsageBefore: vi.fn(
      async (cutoff: Date) => state.aiUsage.filter((d) => d.getTime() < cutoff.getTime()).length,
    ),
    ...overrides,
  };
  return repo;
}

const image = (folder: string, n: number, createdAt: Date | null): StoredImage => ({
  path: `${folder}/${uuid(n)}.jpg`,
  createdAt,
});

/** Una carpeta con: huérfana vieja, huérfana reciente, sin fecha y una con fila. */
function mixedState(): FakeState {
  const folder = USER_A;
  const withRow = image(folder, 4, ago(10 * DAY));
  return {
    folders: {
      [folder]: [
        image(folder, 1, ago(25 * HOUR)),
        image(folder, 2, ago(23 * HOUR)),
        image(folder, 3, null),
        withRow,
      ],
    },
    scanPaths: new Set([withRow.path]),
    aiUsage: [ago(91 * DAY), ago(89 * DAY)],
  };
}

/** `count` imágenes viejas, de las que `orphans` no tienen fila. */
function bulkState(count: number, orphans: number): FakeState {
  const folder = uuid(999);
  const images = Array.from({ length: count }, (_, i) => image(folder, i, ago(2 * DAY)));
  return {
    folders: { [folder]: images },
    scanPaths: new Set(images.slice(orphans).map((i) => i.path)),
    aiUsage: [],
  };
}

async function cli(repo: MaintenanceRepo, argv: string[], env: Record<string, string> = ENV) {
  const lines: string[] = [];
  const code = await runMaintenanceCli({
    argv,
    env,
    createRepo: () => repo,
    now: () => NOW,
    write: (line) => lines.push(line),
  });
  return { code, out: lines.join('\n') };
}

describe('runMaintenance', () => {
  it('borra solo la huérfana de más de 24 h y respeta recientes, sin fecha y con fila', async () => {
    const state = mixedState();
    const repo = fakeRepo(state);

    const report = await runMaintenance(repo, { apply: true, force: false, now: NOW });

    expect(repo.removeImages).toHaveBeenCalledExactlyOnceWith([`${USER_A}/${uuid(1)}.jpg`]);
    expect(report).toMatchObject({
      outcome: 'applied',
      folders: 1,
      imagesChecked: 4,
      orphans: 1,
      recentWithoutRow: 2,
      imagesDeleted: 1,
      batches: 1,
    });
  });

  it('purga ai_usage de 91 días y conserva la de 89', async () => {
    const repo = fakeRepo(mixedState());

    const report = await runMaintenance(repo, { apply: true, force: false, now: NOW });

    const cutoff = vi.mocked(repo.deleteAiUsageBefore).mock.calls[0]?.[0];
    expect(cutoff).toEqual(ago(90 * DAY));
    expect(report).toMatchObject({ aiUsageOld: 1, aiUsageDeleted: 1 });
  });

  it('borra en lotes de 100', async () => {
    // 250 huérfanas de 501 revisadas (< 50 %): no salta el freno.
    const repo = fakeRepo(bulkState(501, 250));

    const report = await runMaintenance(repo, { apply: true, force: false, now: NOW });

    const sizes = vi.mocked(repo.removeImages).mock.calls.map(([paths]) => paths.length);
    expect(sizes).toEqual([100, 100, 50]);
    expect(report).toMatchObject({ imagesChecked: 501, imagesDeleted: 250, batches: 3 });
  });

  it('recorre todas las páginas de una carpeta', async () => {
    const repo = fakeRepo(bulkState(250, 0));

    const report = await runMaintenance(repo, { apply: false, force: false, now: NOW });

    expect(vi.mocked(repo.listPage).mock.calls.map(([, offset]) => offset)).toEqual([
      0, 0, 100, 200,
    ]);
    expect(report.imagesChecked).toBe(250);
  });

  it('en simulación cuenta pero no borra nada', async () => {
    const repo = fakeRepo(mixedState());

    const report = await runMaintenance(repo, { apply: false, force: false, now: NOW });

    expect(repo.removeImages).not.toHaveBeenCalled();
    expect(repo.deleteAiUsageBefore).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      outcome: 'simulated',
      orphans: 1,
      imagesDeleted: 0,
      aiUsageOld: 1,
      aiUsageDeleted: 0,
    });
  });
});

describe('protección: un error de lectura aborta antes de borrar', () => {
  const failing = new SupabaseOpError('No se pudo consultar scans', '500');

  it.each([
    ['existingImagePaths', { existingImagePaths: vi.fn(async () => Promise.reject(failing)) }],
    ['listPage', { listPage: vi.fn(async () => Promise.reject(failing)) }],
    ['countAiUsageBefore', { countAiUsageBefore: vi.fn(async () => Promise.reject(failing)) }],
  ] as const)('si falla %s, sale con 1 y no borra nada', async (_name, override) => {
    const repo = fakeRepo(mixedState(), override);

    const { code, out } = await cli(repo, ['--apply', '--force']);

    expect(code).toBe(1);
    expect(out).toContain('no se borró nada');
    expect(out).toContain('(500)');
    expect(repo.removeImages).not.toHaveBeenCalled();
    expect(repo.deleteAiUsageBefore).not.toHaveBeenCalled();
  });

  it('un error a mitad del borrado sale con 1 e informa lo ya borrado', async () => {
    let calls = 0;
    const repo = fakeRepo(bulkState(501, 250), {
      removeImages: vi.fn(async () => {
        calls += 1;
        if (calls === 2) throw new SupabaseOpError('No se pudieron borrar las imágenes', '503');
      }),
    });

    const { code, out } = await cli(repo, ['--apply']);

    expect(code).toBe(1);
    expect(out).toContain('ERROR al borrar (No se pudieron borrar las imágenes (503))');
    expect(out).toContain('Imágenes borradas: 100 en 1 lotes');
  });
});

describe('protección: freno de seguridad', () => {
  it('con más del 50 % huérfanas (≥ 20 revisadas), --apply no borra nada y lo explica', async () => {
    const repo = fakeRepo({ ...bulkState(20, 11), aiUsage: [ago(91 * DAY)] });

    const { code, out } = await cli(repo, ['--apply']);

    expect(code).toBe(1);
    expect(out).toContain('DETENIDO por el freno de seguridad');
    expect(out).toContain('--apply --force');
    expect(out).toContain('Huérfanas (sin fila y > 24 h): 11');
    expect(repo.removeImages).not.toHaveBeenCalled();
    expect(repo.deleteAiUsageBefore).not.toHaveBeenCalled();
  });

  it('con --force borra aunque salte el freno', async () => {
    const repo = fakeRepo({ ...bulkState(20, 11), aiUsage: [ago(91 * DAY)] });

    const { code, out } = await cli(repo, ['--apply', '--force']);

    expect(code).toBe(0);
    expect(out).toContain('APLICADO');
    expect(repo.removeImages).toHaveBeenCalledOnce();
    expect(repo.deleteAiUsageBefore).toHaveBeenCalledOnce();
  });

  it('con menos de 20 revisadas no frena aunque todas sean huérfanas', async () => {
    const repo = fakeRepo(bulkState(19, 19));

    const { code } = await cli(repo, ['--apply']);

    expect(code).toBe(0);
    expect(repo.removeImages).toHaveBeenCalledOnce();
  });

  it('exactamente el 50 % no frena', async () => {
    const repo = fakeRepo(bulkState(20, 10));

    const { code } = await cli(repo, ['--apply']);

    expect(code).toBe(0);
  });
});

describe('runMaintenanceCli', () => {
  it('por defecto simula y la salida no contiene uuids ni rutas', async () => {
    const repo = fakeRepo(mixedState());

    const { code, out } = await cli(repo, []);

    expect(code).toBe(0);
    expect(out).toContain('SIMULACIÓN');
    expect(out).not.toMatch(UUID_RE);
    expect(out).not.toContain('.jpg');
    expect(repo.removeImages).not.toHaveBeenCalled();
  });

  it('con --apply la salida tampoco contiene uuids', async () => {
    const { out } = await cli(fakeRepo(mixedState()), ['--apply']);
    expect(out).not.toMatch(UUID_RE);
  });

  it('sin variables de Supabase termina con 1 y un mensaje claro, sin tocar nada', async () => {
    const createRepo = vi.fn();
    const lines: string[] = [];

    const code = await runMaintenanceCli({
      argv: ['--apply'],
      env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '' },
      createRepo,
      now: () => NOW,
      write: (line) => lines.push(line),
    });

    expect(code).toBe(1);
    expect(lines.join()).toContain('Faltan variables de entorno: SUPABASE_SERVICE_ROLE_KEY');
    expect(createRepo).not.toHaveBeenCalled();
  });

  it.each([[['--aply']], [['--dry-run', '--apply']]])(
    'rechaza argumentos desconocidos o contradictorios: %j',
    async (argv) => {
      const repo = fakeRepo(mixedState());
      const { code, out } = await cli(repo, argv);
      expect(code).toBe(1);
      expect(out).toContain('Argumentos no válidos');
      expect(repo.listPage).not.toHaveBeenCalled();
    },
  );

  it('la simulación avisa si --apply saltaría el freno', async () => {
    const { code, out } = await cli(fakeRepo(bulkState(20, 11)), []);
    expect(code).toBe(0);
    expect(out).toContain('AVISO: con --apply saltaría el freno');
  });

  it('la simulación no avisa si no saltaría el freno', async () => {
    const { out } = await cli(fakeRepo(bulkState(20, 10)), []);
    expect(out).not.toContain('AVISO');
  });
});

describe('createSupabaseMaintenanceRepo.existingImagePaths', () => {
  function scansClient(error: unknown = null) {
    const inFn = vi.fn(async (_col: string, paths: string[]) => ({
      data: error ? null : paths.slice(0, 1).map((image_path) => ({ image_path })),
      error,
    }));
    const client = {
      from: () => ({ select: () => ({ in: inFn }) }),
    } as unknown as SupabaseClient;
    return { client: () => client, inFn };
  }

  it(`parte la consulta en grupos de ${IMAGE_PATH_QUERY_CHUNK}`, async () => {
    const fake = scansClient();
    const paths = Array.from({ length: 120 }, (_, i) => `${USER_A}/${uuid(i)}.jpg`);

    const found = await createSupabaseMaintenanceRepo(fake.client).existingImagePaths(paths);

    expect(fake.inFn.mock.calls.map(([, chunk]) => chunk.length)).toEqual([50, 50, 20]);
    expect(found.size).toBe(3);
  });

  it('si la consulta falla, lanza (nunca devuelve «sin fila») y sin el mensaje', async () => {
    const fake = scansClient({ message: `bad ${USER_A}`, code: '42P01' });

    const err: unknown = await createSupabaseMaintenanceRepo(fake.client)
      .existingImagePaths([`${USER_A}/x.jpg`])
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SupabaseOpError);
    expect(String(err)).not.toContain(USER_A);
  });
});

describe('createSupabaseMaintenanceRepo.listPage', () => {
  it('separa carpetas e imágenes, ignora los ocultos y marca la página corta como última', async () => {
    const data = [
      { id: null, name: USER_A, created_at: null },
      { id: '1', name: '.emptyFolderPlaceholder', created_at: '2026-01-01T00:00:00Z' },
      { id: '2', name: 'a.jpg', created_at: '2026-10-01T00:00:00Z' },
    ];
    const list = vi.fn(async () => ({ data, error: null }));
    const client = { storage: { from: () => ({ list }) } } as unknown as SupabaseClient;

    const page = await createSupabaseMaintenanceRepo(() => client).listPage('carpeta', 0);

    expect(page).toEqual({
      folders: [`carpeta/${USER_A}`],
      images: [{ path: 'carpeta/a.jpg', createdAt: new Date('2026-10-01T00:00:00Z') }],
      done: true,
    });
  });
});
