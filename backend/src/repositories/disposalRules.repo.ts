import { BIN_CODES, MATERIALS } from '@ecoclasifica/shared';
import { z } from 'zod';
import { getSupabase } from './supabase';

// Forma de la fila en Postgres; no es parte del contrato de la API.
const ruleRowSchema = z
  .object({
    material_code: z.enum(MATERIALS),
    municipality_code: z.string(),
    bin_code: z.enum(BIN_CODES),
    bin_name: z.string(),
    color_hex: z.string(),
    icon: z.string().nullable(),
    instructions: z.string().nullable(),
    requires_drop_off: z.boolean(),
  })
  .transform((row) => ({
    materialCode: row.material_code,
    municipalityCode: row.municipality_code,
    binCode: row.bin_code,
    binName: row.bin_name,
    colorHex: row.color_hex,
    icon: row.icon ?? '',
    instructions: row.instructions ?? '',
    requiresDropOff: row.requires_drop_off,
  }));

export type DisposalRule = z.output<typeof ruleRowSchema>;

/** Tabla pública de reglas (sin datos de usuario): no requiere filtrar por `userId`. */
export interface DisposalRulesRepo {
  listAll(): Promise<DisposalRule[]>;
}

const COLUMNS =
  'material_code, municipality_code, bin_code, bin_name, color_hex, icon, instructions, requires_drop_off';

export function createSupabaseDisposalRulesRepo(): DisposalRulesRepo {
  return {
    async listAll() {
      const { data, error } = await getSupabase().from('disposal_rules').select(COLUMNS);
      if (error) throw new Error(`disposal_rules: ${error.message}`);
      return z.array(ruleRowSchema).parse(data);
    },
  };
}
