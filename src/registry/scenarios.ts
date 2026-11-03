import type { Localized } from './definitions';
export type FaultId = 'failover' | 'budget' | 'ssrf' | 'duplicate';
export const FAULT_IDS: FaultId[] = ['failover', 'budget', 'ssrf', 'duplicate'];
export type SimFaults = Record<FaultId, boolean>;
export const NO_FAULTS: SimFaults = { failover: false, budget: false, ssrf: false, duplicate: false };
export interface Scenario { id: string; label: Localized; fit_score: number; faults: Partial<SimFaults> }
/** One click each. Adding a scenario is adding a line here. */
export const SCENARIOS: Scenario[] = [
  { id: 'fast_track', label: { en: 'FAST_TRACK (fit 88)', ar: 'مسار سريع (ملاءمة 88)' }, fit_score: 88, faults: {} },
  { id: 'proceed', label: { en: 'PROCEED (fit 75)', ar: 'متابعة (ملاءمة 75)' }, fit_score: 75, faults: {} },
  { id: 'escalate', label: { en: 'ESCALATE (fit 62)', ar: 'تصعيد (ملاءمة 62)' }, fit_score: 62, faults: {} },
  { id: 'abort', label: { en: 'ABORT (fit 30)', ar: 'إجهاض (ملاءمة 30)' }, fit_score: 30, faults: {} },
  { id: 'failover', label: { en: 'Model failover (429/503)', ar: 'تحويل النموذج (429/503)' }, fit_score: 88, faults: { failover: true } },
  { id: 'ssrf', label: { en: 'SSRF attempt', ar: 'محاولة SSRF' }, fit_score: 88, faults: { ssrf: true } },
  { id: 'budget', label: { en: 'Budget exceeded', ar: 'تجاوز الميزانية' }, fit_score: 88, faults: { budget: true } },
  { id: 'duplicate', label: { en: 'Duplicate message', ar: 'رسالة مكررة' }, fit_score: 88, faults: { duplicate: true } },
];
