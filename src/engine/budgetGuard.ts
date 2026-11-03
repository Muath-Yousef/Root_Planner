import { microToUsd, usdToMicro, type Micro } from './pricingCalculator';

export type BudgetError = 'TaskBudgetExceededError' | 'DepartmentBudgetExceededError' | 'BudgetReservationConflict' | 'NoReservation';
export type BudgetResult = { ok: true } | { ok: false; error: BudgetError; reason: string };
export interface Reconciliation { released: string[]; spent: Micro; reserved: Micro; available: Micro; overrun_tasks: string[] }
/** §6.1.1 defaults, configurable per department/client (§6.7.1: not sacred constants). */
export const DEFAULT_TASK_CAP = usdToMicro('0.30');
export const DEFAULT_DEPT_DAILY_CAP = usdToMicro('10.00');
interface Hold { dept: string; amount: Micro; at: number }

/**
 * Two layers (§6.1.1): a per-task cap and a per-department daily cap; plus the FIN-001 two-phase flow
 * Reserve -> Commit -> Release -> Reconcile (§6.7.2). All arithmetic is integer micro-USD.
 */
export class BudgetGuard {
  private holds = new Map<string, Hold>();
  private taskSpend = new Map<string, Micro>();
  private deptSpend = new Map<string, Micro>();
  constructor(readonly taskCap: Micro = DEFAULT_TASK_CAP, readonly deptDailyCap: Micro = DEFAULT_DEPT_DAILY_CAP, private readonly now: () => number = () => Date.now()) {}

  private reservedFor(dept: string) { let t = 0; for (const h of this.holds.values()) if (h.dept === dept) t += h.amount; return t; }
  available(dept: string): Micro { return this.deptDailyCap - (this.deptSpend.get(dept) ?? 0) - this.reservedFor(dept); }
  spent(dept: string): Micro { return this.deptSpend.get(dept) ?? 0; }
  taskSpent(task: string): Micro { return this.taskSpend.get(task) ?? 0; }

  /** Reserve: freeze the estimate now. If it does not fit, the task is aborted before any LLM call. */
  reserve(task: string, dept: string, estimate: Micro): BudgetResult {
    const held = this.holds.get(task);
    if (held) return held.amount === estimate && held.dept === dept ? { ok: true } : { ok: false, error: 'BudgetReservationConflict', reason: `Reservation ${task} already holds ${microToUsd(held.amount)}.` };
    const projected = (this.taskSpend.get(task) ?? 0) + estimate;
    if (projected > this.taskCap) return { ok: false, error: 'TaskBudgetExceededError', reason: `Task ${task} projected cost ($${microToUsd(projected)}) exceeds hard cap of $${microToUsd(this.taskCap)}.` };
    if (estimate > this.available(dept)) return { ok: false, error: 'DepartmentBudgetExceededError', reason: `Department ${dept} projected spend exceeds daily budget of $${microToUsd(this.deptDailyCap)} (available $${microToUsd(Math.max(0, this.available(dept)))}).` };
    this.holds.set(task, { dept, amount: estimate, at: this.now() });
    return { ok: true };
  }
  /** Commit the actual cost; the difference to the reservation is released automatically. */
  commit(task: string, actual: Micro): BudgetResult {
    const h = this.holds.get(task);
    if (!h) return { ok: false, error: 'NoReservation', reason: `No reservation ${task} to commit.` };
    this.holds.delete(task);
    this.taskSpend.set(task, (this.taskSpend.get(task) ?? 0) + actual);
    this.deptSpend.set(h.dept, (this.deptSpend.get(h.dept) ?? 0) + actual);
    if ((this.taskSpend.get(task) ?? 0) > this.taskCap) return { ok: false, error: 'TaskBudgetExceededError', reason: `Task ${task} total spend exceeded the cap of $${microToUsd(this.taskCap)}.` };
    return { ok: true };
  }
  release(task: string): BudgetResult { return this.holds.delete(task) ? { ok: true } : { ok: false, error: 'NoReservation', reason: `No reservation ${task} to release.` }; }
  /** Periodic reconciliation: cancel reservations of dead tasks older than `maxAgeMs`. */
  reconcile(maxAgeMs = 0): Reconciliation {
    const t = this.now(), released: string[] = [];
    for (const [id, h] of [...this.holds]) if (t - h.at >= maxAgeMs) { this.holds.delete(id); released.push(id); }
    let spent = 0; for (const v of this.deptSpend.values()) spent += v;
    let reserved = 0; for (const h of this.holds.values()) reserved += h.amount;
    return { released, spent, reserved, available: this.deptDailyCap - spent - reserved, overrun_tasks: [...this.taskSpend].filter(([, v]) => v > this.taskCap).map(([k]) => k) };
  }
}
