import {
  DIFFICULTIES,
  MATERIALS,
  savedScanResultSchema,
  type SavedScanResult,
} from '@ecoclasifica/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabase, SupabaseOpError, supabaseErrorCode } from './supabase';

export const SCAN_IMAGES_BUCKET = 'scan-images';
/** Vida de las URLs firmadas de miniaturas e imágenes (10 min). */
export const SIGNED_URL_TTL_SECONDS = 600;

/** Tamaño de página al listar la carpeta de un usuario en Storage (HU-22). */
export const STORAGE_PAGE_SIZE = 100;

/** Ruta en el bucket privado: la carpeta es el usuario (lo exige la política de Storage). */
export const scanImagePath = (userId: string, scanId: string) => `${userId}/${scanId}.jpg`;

export interface NewScanIdea {
  id: string;
  ideaIndex: number;
  title: string;
  description: string;
  extraMaterials: string[];
}

export interface NewScan {
  id: string;
  userId: string;
  objectName: string;
  materialCode: (typeof MATERIALS)[number] | null;
  materialDetail: string | null;
  confidence: number | null;
  difficulty: (typeof DIFFICULTIES)[number] | null;
  saved: SavedScanResult;
  ideas: NewScanIdea[];
  image: { bytes: Buffer; mimeType: string };
}

// Forma de la fila en Postgres; no es parte del contrato de la API.
const scanRowSchema = z
  .object({
    id: z.string().uuid(),
    created_at: z.string(),
    object_name: z.string(),
    image_path: z.string().nullable(),
    result: savedScanResultSchema,
  })
  .transform((row) => ({
    id: row.id,
    createdAt: row.created_at,
    objectName: row.object_name,
    imagePath: row.image_path,
    saved: row.result,
  }));

export type ScanRecord = z.output<typeof scanRowSchema>;

/** Fila de la lista en su posición: válida, o inválida con solo su id (para registrarla). */
export type ListedScan = { ok: true; record: ScanRecord } | { ok: false; id: string };

const rowIdSchema = z.object({ id: z.string() });
const deletedRowSchema = z.object({ image_path: z.string().nullable() });
const deletedRowsSchema = z.array(deletedRowSchema.extend({ id: z.string() }));

function toListedScan(row: unknown): ListedScan {
  const parsed = scanRowSchema.safeParse(row);
  if (parsed.success) return { ok: true, record: parsed.data };
  const id = rowIdSchema.safeParse(row);
  return { ok: false, id: id.success ? id.data.id : 'desconocido' };
}

const SCAN_COLUMNS = 'id, created_at, object_name, image_path, result';

/** Escaneos del usuario: el service role salta RLS, así que toda consulta filtra por `userId`. */
export interface ScansRepo {
  /** Sube la imagen e inserta `scans` y `scan_ideas`; si algo falla, deshace lo hecho y lanza. */
  save(scan: NewScan): Promise<void>;
  /**
   * Más recientes primero, con desempate por `id` para que la paginación sea estable. Una fila
   * que no cumple el esquema no rompe la lista: se marca como inválida en su posición.
   */
  list(userId: string, range: { offset: number; limit: number }): Promise<ListedScan[]>;
  findById(userId: string, scanId: string): Promise<ScanRecord | null>;
  /** Firma en lote; `null` en la posición de una ruta que no se pudo firmar. */
  signImageUrls(paths: string[]): Promise<(string | null)[]>;
  /**
   * Borra la fila (la base borra en cascada `scan_ideas` y `chat_messages`; `favorites.idea_id`
   * pasa a `null`). Devuelve la ruta de su imagen, o `null` si no existe o es de otro usuario.
   */
  deleteById(userId: string, scanId: string): Promise<{ imagePath: string | null } | null>;
  /**
   * Borra todas las filas del usuario, con las mismas cascadas, y devuelve las borradas. Las
   * rutas salen de esas filas (no de listar la carpeta): un escaneo guardado mientras tanto
   * conserva su imagen.
   */
  deleteAll(userId: string): Promise<DeletedScan[]>;
  removeImages(paths: string[]): Promise<void>;
  /**
   * HU-22: rutas de todas las imágenes de la carpeta `<userId>/` del bucket (no de las filas):
   * así se encuentran también las que quedaron huérfanas.
   */
  listImagePaths(userId: string): Promise<string[]>;
}

export interface DeletedScan {
  id: string;
  imagePath: string | null;
}

export function createSupabaseScansRepo(client: () => SupabaseClient = getSupabase): ScansRepo {
  const bucket = () => client().storage.from(SCAN_IMAGES_BUCKET);

  async function insertRows(scan: NewScan, imagePath: string) {
    const { error } = await client().from('scans').insert({
      id: scan.id,
      user_id: scan.userId,
      mode: scan.saved.mode,
      object_name: scan.objectName,
      material_code: scan.materialCode,
      material_detail: scan.materialDetail,
      confidence: scan.confidence,
      difficulty: scan.difficulty,
      image_path: imagePath,
      result: scan.saved,
    });
    if (error) throw new Error(`No se pudo guardar el escaneo: ${error.message}`);
    if (scan.ideas.length === 0) return;
    const ideas = await client()
      .from('scan_ideas')
      .insert(
        scan.ideas.map((idea) => ({
          id: idea.id,
          scan_id: scan.id,
          idea_index: idea.ideaIndex,
          title: idea.title,
          description: idea.description,
          extra_materials: idea.extraMaterials,
        })),
      );
    if (ideas.error) throw new Error(`No se pudieron guardar las ideas: ${ideas.error.message}`);
  }

  /** Mejor esfuerzo: si la limpieza también falla, gana el error original. */
  async function rollback(scan: NewScan, imagePath: string) {
    await client().from('scans').delete().eq('user_id', scan.userId).eq('id', scan.id);
    await bucket().remove([imagePath]);
  }

  return {
    async save(scan) {
      const imagePath = scanImagePath(scan.userId, scan.id);
      const upload = await bucket().upload(imagePath, scan.image.bytes, {
        contentType: scan.image.mimeType,
        upsert: false,
      });
      if (upload.error) throw new Error(`No se pudo subir la imagen: ${upload.error.message}`);
      try {
        await insertRows(scan, imagePath);
      } catch (err) {
        await rollback(scan, imagePath).catch(() => undefined);
        throw err;
      }
    },

    async list(userId, { offset, limit }) {
      const { data, error } = await client()
        .from('scans')
        .select(SCAN_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
      const rows: unknown[] = data ?? [];
      return rows.map(toListedScan);
    },

    async findById(userId, scanId) {
      const { data, error } = await client()
        .from('scans')
        .select(SCAN_COLUMNS)
        .eq('user_id', userId)
        .eq('id', scanId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el escaneo: ${error.message}`);
      return data ? scanRowSchema.parse(data) : null;
    },

    async signImageUrls(paths) {
      if (paths.length === 0) return [];
      const { data, error } = await bucket().createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error) throw new Error(`No se pudieron firmar las imágenes: ${error.message}`);
      return paths.map((_, i) => {
        const item = data[i];
        return item && !item.error && item.signedUrl ? item.signedUrl : null;
      });
    },

    async deleteById(userId, scanId) {
      const { data, error } = await client()
        .from('scans')
        .delete()
        .eq('user_id', userId)
        .eq('id', scanId)
        .select('image_path')
        .maybeSingle();
      if (error) throw new Error(`No se pudo borrar el escaneo: ${error.message}`);
      return data ? { imagePath: deletedRowSchema.parse(data).image_path } : null;
    },

    async deleteAll(userId) {
      const { data, error } = await client()
        .from('scans')
        .delete()
        .eq('user_id', userId)
        .select('id, image_path');
      if (error) throw new Error(`No se pudo borrar el historial: ${error.message}`);
      return deletedRowsSchema
        .parse(data ?? [])
        .map((row) => ({ id: row.id, imagePath: row.image_path }));
    },

    async removeImages(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket().remove(paths);
      if (error)
        throw new SupabaseOpError('No se pudieron borrar las imágenes', supabaseErrorCode(error));
    },

    async listImagePaths(userId) {
      const paths: string[] = [];
      for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
        const { data, error } = await bucket().list(userId, {
          limit: STORAGE_PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error) {
          throw new SupabaseOpError('No se pudieron listar las imágenes', supabaseErrorCode(error));
        }
        const page = data ?? [];
        // Las subcarpetas llegan con `id: null`; `remove` no las borra y no son imágenes.
        for (const file of page) if (file.id !== null) paths.push(`${userId}/${file.name}`);
        if (page.length < STORAGE_PAGE_SIZE) return paths;
      }
    },
  };
}
