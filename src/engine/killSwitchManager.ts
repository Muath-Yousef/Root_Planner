export type KillLevel = 'TASK' | 'EMPLOYEE' | 'DEPARTMENT' | 'GLOBAL';
export const KILL_TASK_TTL_SECONDS = 86400; // §4.4.1: TASK kills expire after 24h (Redis TTL)
export interface KillRecord { id: number; level: KillLevel; target: string; actor: string; reason: string; engaged_at_ms: number }
export type KillResult = { ok: true; record: KillRecord } | { ok: false; code: 'KILL_REASON_REQUIRED' | 'KILL_NOT_ACTIVE' | 'KILL_HUMAN_REQUIRED' | 'KILL_TARGET_REQUIRED'; reason: string };
export interface KillQuery { task_id?: string; employee_id?: string; department_id?: string }

/**
 * §4.4 / §4.6.1. Engaging is instant and needs no approval (it only makes things safer).
 * TASK expires after 24h; EMPLOYEE is permanent until explicitly released; DEPARTMENT and GLOBAL need a human to release.
 * The manager is plain state so a separate "plane" (CLI, CI) can reuse it; it never calls the application plane.
 */
export class KillSwitchManager {
  private active: KillRecord[] = [];
  private seq = 0;
  constructor(private readonly now: () => number = () => Date.now()) {}

  engage(level: KillLevel, target: string, actor: string, reason: string): KillResult {
    if (level !== 'GLOBAL' && !target.trim()) return { ok: false, code: 'KILL_TARGET_REQUIRED', reason: 'Name the task, employee or department to halt.' };
    const tgt = level === 'GLOBAL' ? '*' : target.trim();
    const hit = this.active.find((r) => r.level === level && r.target === tgt);
    if (hit) return { ok: true, record: hit };
    const record: KillRecord = { id: ++this.seq, level, target: tgt, actor, reason, engaged_at_ms: this.now() };
    this.active.push(record);
    return { ok: true, record };
  }
  release(level: KillLevel, target: string, reason: string, humanConfirmed = false): KillResult {
    if (reason.trim().length < 10) return { ok: false, code: 'KILL_REASON_REQUIRED', reason: 'A release reason of at least 10 characters is required.' };
    if ((level === 'DEPARTMENT' || level === 'GLOBAL') && !humanConfirmed) return { ok: false, code: 'KILL_HUMAN_REQUIRED', reason: `${level} release needs explicit human intervention.` };
    const tgt = level === 'GLOBAL' ? '*' : target.trim();
    const i = this.active.findIndex((r) => r.level === level && r.target === tgt);
    if (i < 0) return { ok: false, code: 'KILL_NOT_ACTIVE', reason: `No active ${level} kill for ${tgt}.` };
    return { ok: true, record: this.active.splice(i, 1)[0] };
  }
  private prune() { const t = this.now(); this.active = this.active.filter((r) => r.level !== 'TASK' || t - r.engaged_at_ms < KILL_TASK_TTL_SECONDS * 1000); }
  /** First active record that covers the query, if any. */
  halted(q: KillQuery): KillRecord | undefined {
    this.prune();
    return this.active.find((r) => r.level === 'GLOBAL' || (r.level === 'TASK' && r.target === q.task_id) || (r.level === 'EMPLOYEE' && r.target === q.employee_id) || (r.level === 'DEPARTMENT' && r.target === q.department_id));
  }
  records(): readonly KillRecord[] { this.prune(); return this.active; }
}
