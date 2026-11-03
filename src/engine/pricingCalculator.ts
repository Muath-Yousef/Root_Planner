import { load } from 'js-yaml';
/** Money is integer micro-USD (6 decimals, §6.1.2). No floating point ever touches a balance. */
export type Micro = number;
export const MICRO = 1_000_000;
export const usdToMicro = (v: number | string): Micro => {
  const s = typeof v === 'number' ? v.toFixed(6) : v.trim();
  const m = /^(\d{1,9})(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) throw new Error(`Invalid USD amount: ${s}`);
  return Number(m[1]) * MICRO + Number((m[2] ?? '').padEnd(6, '0'));
};
export const microToUsd = (m: Micro): string => `${m < 0 ? '-' : ''}${Math.trunc(Math.abs(m) / MICRO)}.${String(Math.abs(m) % MICRO).padStart(6, '0')}`;
export const microToNumber = (m: Micro): number => Number(microToUsd(m));

export interface Rate { input_per_million: number; output_per_million: number; cache_read_per_million?: number; cache_write_per_million?: number }
export type PricingTable = Record<string, Rate>;
export function parsePricing(text: string): PricingTable {
  try { return ((load(text) as { models?: PricingTable } | undefined)?.models) ?? {}; } catch { return {}; }
}
const milli = (r = 0) => Math.round(r * 1000);
/** Cost = (Σ tokens × rate per million) / 1e6, rounded to 6 decimals — in micro-USD: Σ tokens × rate. Unknown model falls back to `default`, else throws. */
export function costMicro(table: PricingTable, model: string, tin: number, tout: number, cacheRead = 0, cacheWrite = 0): Micro {
  const r = table[model] ?? table.default;
  if (!r) throw new Error(`No price for model ${model}`);
  const sum = tin * milli(r.input_per_million) + tout * milli(r.output_per_million) + cacheRead * milli(r.cache_read_per_million) + cacheWrite * milli(r.cache_write_per_million);
  return Math.round(sum / 1000);
}
export const costUsd = (...a: Parameters<typeof costMicro>) => microToNumber(costMicro(...a));
