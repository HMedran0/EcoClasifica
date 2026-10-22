import { vi } from 'vitest';
import type { AiUsageRepo, AiUsageRow } from '../../src/repositories/aiUsage.repo';

export interface StoredUsage extends AiUsageRow {
  createdAt: Date;
}

/** Fila de uso con valores por defecto (para sembrar cuotas). */
export function usageRow(overrides: Partial<StoredUsage> = {}): StoredUsage {
  return {
    endpoint: 'classify',
    userId: null,
    ipHash: null,
    scanId: null,
    promptTokens: 400,
    completionTokens: 90,
    latencyMs: 1600,
    createdAt: new Date(),
    ...overrides,
  };
}

export const rowsOf = (count: number, overrides: Partial<StoredUsage>) =>
  Array.from({ length: count }, () => usageRow(overrides));

/** `ai_usage` en memoria: cuenta por usuario o por hash de IP y suma tokens desde una hora. */
export function memoryAiUsageRepo(initial: StoredUsage[] = [], now: () => Date = () => new Date()) {
  const rows = [...initial];

  const repo = {
    rows,
    record: vi.fn<AiUsageRepo['record']>(async (row) => {
      rows.push({ ...row, createdAt: now() });
    }),
    countSince: vi.fn<AiUsageRepo['countSince']>(
      async (subject, endpoints, since) =>
        rows.filter(
          (r) =>
            ('userId' in subject ? r.userId === subject.userId : r.ipHash === subject.ipHash) &&
            endpoints.includes(r.endpoint) &&
            r.createdAt >= since,
        ).length,
    ),
    tokensSince: vi.fn<AiUsageRepo['tokensSince']>(async (since) =>
      rows
        .filter((r) => r.createdAt >= since)
        .reduce((sum, r) => sum + (r.promptTokens ?? 0) + (r.completionTokens ?? 0), 0),
    ),
  };
  return repo satisfies AiUsageRepo;
}
