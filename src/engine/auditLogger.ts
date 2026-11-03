export const GENESIS = 'GENESIS';
export const TAMPER_CODE = 'AUDIT_TAMPER_ATTEMPT';
export const TAMPER_MESSAGE = `SECURITY VIOLATION [${TAMPER_CODE}]`;
export interface AuditRecord {
  log_id: string; task_id: string; employee_id: string; event_type: string; event_data: unknown;
  prev_hash: string; entry_hash: string; created_at: string;
}
export interface Violation { type: 'PREV_HASH_MISMATCH' | 'ENTRY_HASH_MISMATCH'; log_id: string; index: number; expected?: string; found?: string; computed?: string; stored?: string }

export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** Python `json.dumps(data, sort_keys=True, ensure_ascii=False)`: sorted keys, ", " and ": " separators. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}: ${canonicalJson((v as Record<string, unknown>)[k])}`).join(', ')}}`;
  return JSON.stringify(v) ?? 'null';
}
/** §5.3.8: SHA256(prev_hash|log_id|task_id|employee_id|event_type|canonical_data|created_at_iso) */
export const computeHash = (r: Pick<AuditRecord, 'prev_hash' | 'log_id' | 'task_id' | 'employee_id' | 'event_type' | 'event_data' | 'created_at'>) =>
  sha256([r.prev_hash, r.log_id, r.task_id, r.employee_id, r.event_type, canonicalJson(r.event_data), r.created_at].join('|'));

export type ChainResult = { ok: true; length: number; violations: [] } | { ok: false; violations: Violation[]; code: typeof TAMPER_CODE; message: string };

export class AuditLogger {
  records: AuditRecord[] = [];
  constructor(private readonly clock: () => string = () => new Date().toISOString(), private readonly uuid: () => string = () => crypto.randomUUID()) {}
  async record(task_id: string, employee_id: string, event_type: string, event_data: unknown): Promise<AuditRecord> {
    const base = { log_id: this.uuid(), task_id, employee_id, event_type, event_data, prev_hash: this.records.at(-1)?.entry_hash ?? GENESIS, created_at: this.clock() };
    const rec: AuditRecord = { ...base, entry_hash: await computeHash(base) };
    this.records.push(rec);
    return rec;
  }
  /** Walks the whole chain from GENESIS and returns every violation (empty when intact). */
  async verifyChainIntegrity(): Promise<Violation[]> {
    const out: Violation[] = [];
    let prev = GENESIS;
    for (const [index, r] of this.records.entries()) {
      if (r.prev_hash !== prev) out.push({ type: 'PREV_HASH_MISMATCH', log_id: r.log_id, index, expected: prev, found: r.prev_hash });
      const computed = await computeHash(r);
      if (computed !== r.entry_hash) out.push({ type: 'ENTRY_HASH_MISMATCH', log_id: r.log_id, index, computed, stored: r.entry_hash });
      prev = r.entry_hash;
    }
    return out;
  }
  async verify(): Promise<ChainResult> {
    const violations = await this.verifyChainIntegrity();
    return violations.length === 0 ? { ok: true, length: this.records.length, violations: [] }
      : { ok: false, violations, code: TAMPER_CODE, message: `${TAMPER_MESSAGE} at entry #${violations[0].index}` };
  }
}
