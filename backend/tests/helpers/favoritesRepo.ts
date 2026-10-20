import { randomUUID } from 'node:crypto';
import type { Favorite } from '@ecoclasifica/shared';
import { vi } from 'vitest';
import type { FavoritesRepo, IdeaSnapshot } from '../../src/repositories/favorites.repo';

/** Idea de `scan_ideas` con el dueño de su escaneo (lo que exige el join real). */
export interface StoredIdea extends IdeaSnapshot {
  ownerId: string;
}

export interface StoredFavorite extends Favorite {
  userId: string;
}

export function storedIdea(ownerId: string, overrides: Partial<StoredIdea> = {}): StoredIdea {
  return {
    ideaId: randomUUID(),
    ownerId,
    objectName: 'Frasco de vidrio',
    difficulty: 'Fácil',
    title: 'Portalápices',
    description: 'Lava el frasco y decóralo con cuerda.',
    extraMaterials: ['cuerda', 'pegante'],
    ...overrides,
  };
}

/** La idea sin su dueño, como la devuelve el join real. */
export const snapshotOf = ({ ownerId: _ownerId, ...snapshot }: StoredIdea): IdeaSnapshot =>
  snapshot;

/**
 * Repositorio en memoria que respeta el contrato de `FavoritesRepo`: filtra por usuario, la idea
 * solo es visible para el dueño de su escaneo y `(userId, ideaId)` es único.
 */
export function memoryFavoritesRepo(ideas: StoredIdea[] = [], initial: StoredFavorite[] = []) {
  const rows = [...initial];
  const strip = ({ userId: _userId, ...favorite }: StoredFavorite): Favorite => favorite;
  const own = (userId: string) => rows.filter((row) => row.userId === userId);
  let clock = 0;

  const repo = {
    rows,
    findIdeaSnapshot: vi.fn<FavoritesRepo['findIdeaSnapshot']>(async (userId, ideaId) => {
      const idea = ideas.find((i) => i.ideaId === ideaId && i.ownerId === userId);
      return idea ? snapshotOf(idea) : null;
    }),
    findByIdea: vi.fn<FavoritesRepo['findByIdea']>(async (userId, ideaId) => {
      const row = own(userId).find((r) => r.ideaId === ideaId);
      return row ? strip(row) : null;
    }),
    insert: vi.fn<FavoritesRepo['insert']>(async (userId, snapshot) => {
      if (own(userId).some((r) => r.ideaId === snapshot.ideaId)) return null;
      const row: StoredFavorite = {
        ...snapshot,
        id: randomUUID(),
        userId,
        createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, clock++)).toISOString(),
      };
      rows.push(row);
      return strip(row);
    }),
    remove: vi.fn<FavoritesRepo['remove']>(async (userId, favoriteId) => {
      const index = rows.findIndex((r) => r.userId === userId && r.id === favoriteId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    }),
    list: vi.fn<FavoritesRepo['list']>(async (userId, { offset, limit }) =>
      own(userId)
        .sort((a, b) =>
          a.createdAt === b.createdAt
            ? Number(b.id > a.id) - Number(b.id < a.id)
            : Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )
        .slice(offset, offset + limit)
        .map(strip),
    ),
    idsByIdeas: vi.fn<FavoritesRepo['idsByIdeas']>(
      async (userId, ideaIds) =>
        new Map(
          own(userId).flatMap((r) =>
            r.ideaId && ideaIds.includes(r.ideaId) ? [[r.ideaId, r.id] as const] : [],
          ),
        ),
    ),
  };
  return repo satisfies FavoritesRepo;
}
