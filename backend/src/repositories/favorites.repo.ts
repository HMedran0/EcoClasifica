import { DIFFICULTIES, type Favorite } from '@ecoclasifica/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabase } from './supabase';

/** Lo que se copia en `favorites`: objeto y dificultad del escaneo; el resto, de la idea. */
export interface IdeaSnapshot {
  ideaId: string;
  objectName: string;
  difficulty: (typeof DIFFICULTIES)[number] | null;
  title: string;
  description: string;
  extraMaterials: string[];
}

// Formas de las filas en Postgres; no son parte del contrato de la API.
const favoriteRowSchema = z
  .object({
    id: z.string().uuid(),
    idea_id: z.string().uuid().nullable(),
    object_name: z.string(),
    difficulty: z.enum(DIFFICULTIES).nullable(),
    title: z.string(),
    description: z.string(),
    extra_materials: z.array(z.string()),
    created_at: z.string(),
  })
  .transform((row): Favorite => ({
    id: row.id,
    ideaId: row.idea_id,
    objectName: row.object_name,
    difficulty: row.difficulty,
    title: row.title,
    description: row.description,
    extraMaterials: row.extra_materials,
    createdAt: row.created_at,
  }));

const ideaRowSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    extra_materials: z.array(z.string()),
    scans: z.object({
      object_name: z.string(),
      difficulty: z.enum(DIFFICULTIES).nullable(),
    }),
  })
  .transform((row): IdeaSnapshot => ({
    ideaId: row.id,
    objectName: row.scans.object_name,
    difficulty: row.scans.difficulty,
    title: row.title,
    description: row.description,
    extraMaterials: row.extra_materials,
  }));

const ideaFavoriteRowSchema = z.object({ id: z.string().uuid(), idea_id: z.string().uuid() });

// Los errores de Postgres solo llevan su código: el mensaje puede citar la fila.
const FAVORITE_COLUMNS =
  'id, idea_id, object_name, difficulty, title, description, extra_materials, created_at';

/**
 * Valida filas de Postgres. Una fila inválida es un error interno (500): el `ZodError` llegaría al
 * manejador como un 400 del cliente, y su detalle podría citar datos de la fila.
 */
function parseRow<S extends z.ZodTypeAny>(schema: S, row: unknown): z.output<S> {
  const parsed = schema.safeParse(row);
  if (!parsed.success) throw new Error('Fila de favoritos con forma inválida');
  return parsed.data as z.output<S>;
}

/** Violación de `unique (user_id, idea_id)`: otra petición guardó la misma idea a la vez. */
const UNIQUE_VIOLATION = '23505';

/** Favoritos del usuario: el service role salta RLS, así que toda consulta filtra por `userId`. */
export interface FavoritesRepo {
  /** La idea solo si su escaneo es del usuario (join con `scans.user_id`); si no, `null`. */
  findIdeaSnapshot(userId: string, ideaId: string): Promise<IdeaSnapshot | null>;
  findByIdea(userId: string, ideaId: string): Promise<Favorite | null>;
  /** `null` si ya existía (conflicto de unicidad); el servicio relee la existente. */
  insert(userId: string, snapshot: IdeaSnapshot): Promise<Favorite | null>;
  /** `false` si no existe o es de otro usuario. */
  remove(userId: string, favoriteId: string): Promise<boolean>;
  /** Más recientes primero, con desempate por `id` para que la paginación sea estable. */
  list(userId: string, range: { offset: number; limit: number }): Promise<Favorite[]>;
  /** `ideaId → favoriteId` de las ideas que el usuario guardó. */
  idsByIdeas(userId: string, ideaIds: string[]): Promise<Map<string, string>>;
}

export function createSupabaseFavoritesRepo(
  client: () => SupabaseClient = getSupabase,
): FavoritesRepo {
  const favorites = () => client().from('favorites');

  return {
    async findIdeaSnapshot(userId, ideaId) {
      const { data, error } = await client()
        .from('scan_ideas')
        .select('id, title, description, extra_materials, scans!inner(object_name, difficulty)')
        .eq('id', ideaId)
        .eq('scans.user_id', userId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer la idea (${error.code})`);
      return data ? parseRow(ideaRowSchema, data) : null;
    },

    async findByIdea(userId, ideaId) {
      const { data, error } = await favorites()
        .select(FAVORITE_COLUMNS)
        .eq('user_id', userId)
        .eq('idea_id', ideaId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el favorito (${error.code})`);
      return data ? parseRow(favoriteRowSchema, data) : null;
    },

    async insert(userId, snapshot) {
      const { data, error } = await favorites()
        .insert({
          user_id: userId,
          idea_id: snapshot.ideaId,
          object_name: snapshot.objectName,
          difficulty: snapshot.difficulty,
          title: snapshot.title,
          description: snapshot.description,
          extra_materials: snapshot.extraMaterials,
        })
        .select(FAVORITE_COLUMNS)
        .single();
      if (error?.code === UNIQUE_VIOLATION) return null;
      if (error) throw new Error(`No se pudo guardar el favorito (${error.code})`);
      return parseRow(favoriteRowSchema, data);
    },

    async remove(userId, favoriteId) {
      const { data, error } = await favorites()
        .delete()
        .eq('user_id', userId)
        .eq('id', favoriteId)
        .select('id');
      if (error) throw new Error(`No se pudo quitar el favorito (${error.code})`);
      return (data ?? []).length > 0;
    },

    async list(userId, { offset, limit }) {
      const { data, error } = await favorites()
        .select(FAVORITE_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`No se pudieron leer los favoritos (${error.code})`);
      const rows: unknown[] = data ?? [];
      return rows.map((row) => parseRow(favoriteRowSchema, row));
    },

    async idsByIdeas(userId, ideaIds) {
      if (ideaIds.length === 0) return new Map();
      const { data, error } = await favorites()
        .select('id, idea_id')
        .eq('user_id', userId)
        .in('idea_id', ideaIds);
      if (error) throw new Error(`No se pudieron leer los favoritos (${error.code})`);
      const rows: unknown[] = data ?? [];
      return new Map(
        rows.map((row) => {
          const { id, idea_id } = parseRow(ideaFavoriteRowSchema, row);
          return [idea_id, id];
        }),
      );
    },
  };
}
