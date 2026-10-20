import { randomUUID } from 'node:crypto';
import type { SavedScanResult } from '@ecoclasifica/shared';
import { vi } from 'vitest';
import type { ListedScan, NewScan, ScanRecord, ScansRepo } from '../../src/repositories/scans.repo';
import { scanImagePath } from '../../src/repositories/scans.repo';
import type { TokenVerifier } from '../../src/services/auth.service';

export const USER_A = '5b6f1c2e-8a3d-4f7b-9c1e-2d4a6b8c0e1f';
export const USER_B = '9d2e4f6a-1b3c-4d5e-8f7a-0b1c2d3e4f5a';
export const TOKEN_A = 'token-de-ana';
export const TOKEN_B = 'token-de-beto';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Dos usuarios fijos: cada token resuelve a su dueño; cualquier otro es inválido. */
export const fakeVerifier: TokenVerifier = {
  async verify(token) {
    if (token === TOKEN_A) return { id: USER_A, email: 'ana@ejemplo.com' };
    if (token === TOKEN_B) return { id: USER_B, email: 'beto@ejemplo.com' };
    return null;
  },
};

export interface StoredScan extends ScanRecord {
  userId: string;
  /** Simula una fila cuyo `result` no cumple el esquema. */
  corrupt?: boolean;
}

export const classifySaved: SavedScanResult = {
  mode: 'classify',
  result: {
    object: 'Botella de agua',
    material: 'plastico',
    materialDetail: 'PET',
    confidence: 0.92,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: {
    binCode: 'WHITE',
    binName: 'Contenedor blanco (aprovechables)',
    colorHex: '#F5F5F5',
    icon: 'bin-white',
    instructions: 'Limpio y seco.',
    requiresDropOff: false,
  },
};

export function storedScan(userId: string, overrides: Partial<StoredScan> = {}): StoredScan {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    userId,
    createdAt: '2026-10-20T12:00:00+00:00',
    objectName: 'Botella de agua',
    imagePath: scanImagePath(userId, id),
    saved: classifySaved,
    ...overrides,
  };
}

/**
 * Repositorio en memoria que respeta el contrato de `ScansRepo`: filtra por usuario y ordena
 * por `createdAt` desc y luego `id` desc, igual que la consulta real.
 */
export function memoryScansRepo(
  initial: StoredScan[] = [],
  /** Simula las cascadas de la base al borrar filas (ideas, favoritos, mensajes). */
  onDelete: (scanIds: string[]) => void = () => undefined,
) {
  const rows = [...initial];
  /** Contenido del bucket: una imagen por escaneo que la tenga. */
  const images = new Set(initial.flatMap((row) => (row.imagePath ? [row.imagePath] : [])));
  const removeRows = (match: (row: StoredScan) => boolean) => {
    const gone = rows.filter(match);
    for (const row of gone) rows.splice(rows.indexOf(row), 1);
    if (gone.length > 0) onDelete(gone.map((row) => row.id));
    return gone;
  };
  const visible = (userId: string) =>
    rows
      .filter((row) => row.userId === userId)
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? Number(b.id > a.id) - Number(b.id < a.id)
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  const strip = ({ userId: _userId, corrupt: _corrupt, ...record }: StoredScan): ScanRecord =>
    record;
  const listed = (row: StoredScan): ListedScan =>
    row.corrupt ? { ok: false, id: row.id } : { ok: true, record: strip(row) };

  const repo = {
    rows,
    images,
    save: vi.fn<ScansRepo['save']>(async (scan: NewScan) => {
      rows.push({
        id: scan.id,
        userId: scan.userId,
        createdAt: new Date().toISOString(),
        objectName: scan.objectName,
        imagePath: scanImagePath(scan.userId, scan.id),
        saved: scan.saved,
      });
      images.add(scanImagePath(scan.userId, scan.id));
    }),
    list: vi.fn<ScansRepo['list']>(async (userId, { offset, limit }) =>
      visible(userId)
        .slice(offset, offset + limit)
        .map(listed),
    ),
    findById: vi.fn<ScansRepo['findById']>(async (userId, scanId) => {
      const row = visible(userId).find((r) => r.id === scanId);
      // Como el repositorio real: una fila corrupta en el detalle lanza (500).
      if (row?.corrupt) throw new Error('Fila de escaneo inválida');
      return row ? strip(row) : null;
    }),
    signImageUrls: vi.fn<ScansRepo['signImageUrls']>(async (paths) =>
      paths.map((path) => `https://firmado.test/${path}?token=t`),
    ),
    deleteById: vi.fn<ScansRepo['deleteById']>(async (userId, scanId) => {
      const [row] = removeRows((r) => r.userId === userId && r.id === scanId);
      return row ? { imagePath: row.imagePath } : null;
    }),
    deleteAll: vi.fn<ScansRepo['deleteAll']>(async (userId) =>
      removeRows((r) => r.userId === userId).map(({ id, imagePath }) => ({ id, imagePath })),
    ),
    removeImages: vi.fn<ScansRepo['removeImages']>(async (paths) => {
      for (const path of paths) images.delete(path);
    }),
  };
  return repo satisfies ScansRepo;
}
