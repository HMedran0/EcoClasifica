import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SCAN_IMAGES_BUCKET, STORAGE_PAGE_SIZE } from './scans.repo';
import { getSupabase, SupabaseOpError, supabaseErrorCode } from './supabase';

/**
 * Rutas por consulta `image_path in (...)`. Una ruta pesa ~80 caracteres y codificada en la URL
 * más de 100: con 50 la URL de PostgREST queda bajo ~6 KB, lejos del límite de los proxies.
 */
export const IMAGE_PATH_QUERY_CHUNK = 50;

/** Un objeto de Storage. `createdAt` es `null` si Storage no lo informa. */
export interface StoredImage {
  path: string;
  createdAt: Date | null;
}

/** Una página del bucket `scan-images`: imágenes y subcarpetas. */
export interface StoragePage {
  images: StoredImage[];
  folders: string[];
  /** `false` si la página llegó llena (`STORAGE_PAGE_SIZE` objetos) y puede haber más. */
  done: boolean;
}

/**
 * Mantenimiento del piloto (F5). Usa la service role key; recorre todos los usuarios a propósito.
 * Todo fallo lanza `SupabaseOpError` (sin el mensaje de Supabase, que puede citar rutas).
 */
export interface MaintenanceRepo {
  /** Página `offset` de la carpeta (`''` es la raíz del bucket). */
  listPage(folder: string, offset: number): Promise<StoragePage>;
  /** De `paths`, las que tienen una fila en `scans`. */
  existingImagePaths(paths: string[]): Promise<Set<string>>;
  removeImages(paths: string[]): Promise<void>;
  countAiUsageBefore(cutoff: Date): Promise<number>;
  /** Devuelve cuántas filas borró. */
  deleteAiUsageBefore(cutoff: Date): Promise<number>;
}

const imagePathRowsSchema = z.array(z.object({ image_path: z.string().nullable() }));

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createSupabaseMaintenanceRepo(
  client: () => SupabaseClient = getSupabase,
): MaintenanceRepo {
  const bucket = () => client().storage.from(SCAN_IMAGES_BUCKET);
  const aiUsage = () => client().from('ai_usage');

  return {
    async listPage(folder, offset) {
      const { data, error } = await bucket().list(folder, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new SupabaseOpError('No se pudo listar Storage', supabaseErrorCode(error));
      const page = data ?? [];
      const prefix = folder ? `${folder}/` : '';
      const images: StoredImage[] = [];
      const folders: string[] = [];
      // Las subcarpetas llegan con `id: null`; los ocultos (`.emptyFolderPlaceholder`) no son imágenes.
      for (const item of page) {
        if (item.name.startsWith('.')) continue;
        if (item.id === null) folders.push(`${prefix}${item.name}`);
        else images.push({ path: `${prefix}${item.name}`, createdAt: toDate(item.created_at) });
      }
      return { images, folders, done: page.length < STORAGE_PAGE_SIZE };
    },

    async existingImagePaths(paths) {
      const found = new Set<string>();
      for (let i = 0; i < paths.length; i += IMAGE_PATH_QUERY_CHUNK) {
        const chunk = paths.slice(i, i + IMAGE_PATH_QUERY_CHUNK);
        const { data, error } = await client()
          .from('scans')
          .select('image_path')
          .in('image_path', chunk);
        if (error)
          throw new SupabaseOpError('No se pudo consultar scans', supabaseErrorCode(error));
        for (const row of imagePathRowsSchema.parse(data ?? []))
          if (row.image_path) found.add(row.image_path);
      }
      return found;
    },

    async removeImages(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket().remove(paths);
      if (error)
        throw new SupabaseOpError('No se pudieron borrar las imágenes', supabaseErrorCode(error));
    },

    async countAiUsageBefore(cutoff) {
      const { count, error } = await aiUsage()
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoff.toISOString());
      if (error) throw new SupabaseOpError('No se pudo contar ai_usage', supabaseErrorCode(error));
      return count ?? 0;
    },

    async deleteAiUsageBefore(cutoff) {
      const { count, error } = await aiUsage()
        .delete({ count: 'exact' })
        .lt('created_at', cutoff.toISOString());
      if (error) throw new SupabaseOpError('No se pudo purgar ai_usage', supabaseErrorCode(error));
      return count ?? 0;
    },
  };
}
