export interface ChatMessage { role: 'system' | 'user'; content: string }
export interface WorkingState { current_step: string; decision_trail: string[]; running_cost_usd: number; has_results?: boolean }
export interface ContextInput {
  identity_prompt: string; policy_constraints: string[]; objective: string; success_criteria: string[];
  evidence_text: string; working_memory: WorkingState; historical_context?: string;
}
/** §5.2.2: the six-layer injection order is fixed; changing it changes model reasoning. */
export function buildLlmContext(i: ContextInput): ChatMessage[] {
  const m: ChatMessage[] = [{ role: 'system', content: i.identity_prompt }];
  if (i.policy_constraints.length) m.push({ role: 'system', content: `[GOVERNING POLICY CONSTRAINTS]\n${i.policy_constraints.map((c) => `- ${c}`).join('\n')}` });
  m.push({ role: 'user', content: `[TASK OBJECTIVE]\n${i.objective}\n\n[SUCCESS CRITERIA]\n${i.success_criteria.map((c) => `- ${c}`).join('\n')}` });
  if (i.evidence_text) m.push({ role: 'user', content: `[GROUNDED EVIDENCE]\n${i.evidence_text}` });
  const w = i.working_memory;
  if (w.has_results || w.decision_trail.length) m.push({ role: 'user', content: `[CURRENT WORKING STATE]\nStep: ${w.current_step}\nDecisions: ${JSON.stringify(w.decision_trail.slice(-3))}\nCost so far: $${w.running_cost_usd.toFixed(4)}` });
  if (i.historical_context) m.push({ role: 'user', content: `[HISTORICAL PRECEDENT]\n${i.historical_context}` });
  return m;
}
export const CONTEXT_LAYERS = ['identity', 'policy_constraints', 'objective', 'evidence', 'working_state', 'historical'] as const;

/** Tenant-safe retrieval filter used before anything reaches layer 6 (TEN-003). */
export interface MemoryItem { id: string; tenant_id: string; text: string; score: number }
export function retrieveForTenant(items: MemoryItem[], tenant_id: string, limit: number): { included: MemoryItem[]; dropped: { id: string; reason: 'TENANT_MISMATCH' | 'LIMIT' }[] } {
  const dropped: { id: string; reason: 'TENANT_MISMATCH' | 'LIMIT' }[] = [];
  const ok = items.filter((x) => (x.tenant_id === tenant_id ? true : (dropped.push({ id: x.id, reason: 'TENANT_MISMATCH' }), false))).sort((a, b) => b.score - a.score);
  ok.slice(limit).forEach((x) => dropped.push({ id: x.id, reason: 'LIMIT' }));
  return { included: ok.slice(0, limit), dropped };
}
