export type Decision = 'FAST_TRACK' | 'PROCEED' | 'ESCALATE' | 'ABORT';
/** §3.3.1 decision_rule defaults. */
export const DECISION_RULE = { minimum_viable_score: 70.0, fast_track_threshold: 85.0, automatic_abort_threshold: 40.0, ambiguous_low: 50.0 } as const;
export interface DecisionResult { decision: Decision; band: string; note?: string; policy?: string }

/**
 * Thresholds from §3.3.1: >=85 FAST_TRACK · 70–84.99 PROCEED · 50–69.99 ESCALATE (POL_EVA_AMBIGUOUS_SCORE) · <40 ABORT.
 * The reference does not define 40.0 <= score < 50.0; it fails closed to ESCALATE (docs/REFERENCE_GAPS.md G-05).
 */
export function decide(score: number, rule = DECISION_RULE): DecisionResult {
  if (!Number.isFinite(score) || score < 0 || score > 100) return { decision: 'ESCALATE', band: 'invalid', note: 'Score outside 0–100; escalated (fail-closed).' };
  if (score >= rule.fast_track_threshold) return { decision: 'FAST_TRACK', band: '>= 85.0' };
  if (score >= rule.minimum_viable_score) return { decision: 'PROCEED', band: '70.0–84.9' };
  if (score >= rule.ambiguous_low) return { decision: 'ESCALATE', band: '50.0–69.9', policy: 'POL_EVA_AMBIGUOUS_SCORE' };
  if (score < rule.automatic_abort_threshold) return { decision: 'ABORT', band: '< 40.0' };
  return { decision: 'ESCALATE', band: '40.0–49.9 (unspecified)', policy: 'POL_EVA_UNSPECIFIED_BAND', note: 'Scores from 40.0 to 49.9 are not specified by the reference; escalated (fail-closed).' };
}
/** §3.3.2: Σ(weight × satisfaction) / Σ(weights) × 100, rounded to 2 decimals. */
export function calculateFitScore(criteria: Record<string, number>, requirements: string[], weights?: Record<string, number>): number {
  const w = weights ?? Object.fromEntries(Object.keys(criteria).map((k) => [k, 1.0]));
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weighted = requirements.reduce((s, c) => s + (w[c] ?? 1.0) * (criteria[c] ?? 0.0), 0);
  return Math.round((weighted / total) * 10000) / 100;
}
