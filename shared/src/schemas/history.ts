import { z } from 'zod';
import { classifyResultSchema, disposalSchema, upcycleResultSchema } from './scan';

export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_MAX_PAGE = 1000;

/** GET /api/v1/history?page=N (HU-13). Fuera de rango con datos: `items: []` y `hasMore: false`. */
export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(HISTORY_MAX_PAGE).default(1),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/** Un id mal formado responde 404, igual que el de otro usuario. */
export const historyIdSchema = z.string().uuid();

export const scanModeSchema = z.enum(['classify', 'upcycle']);

export const historyItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  mode: scanModeSchema,
  objectName: z.string(),
  /** Nombre del contenedor, «3 ideas» o «No reutilizable». */
  summary: z.string(),
  /** URL firmada de corta duración (10 min); `null` si no hay imagen. */
  thumbnailUrl: z.string().url().nullable(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const historyListResponseSchema = z.object({
  items: z.array(historyItemSchema),
  page: z.number().int().min(1),
  pageSize: z.literal(HISTORY_PAGE_SIZE),
  hasMore: z.boolean(),
});
export type HistoryListResponse = z.infer<typeof historyListResponseSchema>;

/** Copia de lo que vio el usuario (columna `scans.result`): el detalle no vuelve a llamar a la IA. */
export const savedScanResultSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('classify'),
    result: classifyResultSchema,
    disposal: disposalSchema.nullable(),
  }),
  z.object({ mode: z.literal('upcycle'), result: upcycleResultSchema }),
]);
export type SavedScanResult = z.infer<typeof savedScanResultSchema>;

const detailBase = {
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  /** URL firmada de corta duración (10 min); `null` si no hay imagen. */
  imageUrl: z.string().url().nullable(),
};

/** GET /api/v1/history/:id: el escaneo guardado, con la misma forma que la respuesta original. */
export const historyDetailSchema = z.discriminatedUnion('mode', [
  savedScanResultSchema.options[0].extend(detailBase),
  savedScanResultSchema.options[1].extend(detailBase),
]);
export type HistoryDetail = z.infer<typeof historyDetailSchema>;
