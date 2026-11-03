import type { AutonomyState, DeploymentState, LifecycleState } from './model';

export interface Machine<S extends string> { id: string; initial: S; states: readonly S[]; transitions: Record<S, readonly S[]> }

/** LIF-001 (§6.9.1). The arrows in the reference are the forward path; back-edges are studio interpretations (docs/REFERENCE_GAPS.md G-08). */
export const LIFECYCLE: Machine<LifecycleState> = {
  id: 'lifecycle', initial: 'DRAFT', states: ['DRAFT', 'VALIDATED', 'BENCHMARKED', 'CERTIFIED', 'DEPRECATED'],
  transitions: { DRAFT: ['VALIDATED', 'DEPRECATED'], VALIDATED: ['BENCHMARKED', 'DRAFT', 'DEPRECATED'], BENCHMARKED: ['CERTIFIED', 'VALIDATED', 'DEPRECATED'], CERTIFIED: ['DEPRECATED'], DEPRECATED: [] },
};
export const DEPLOYMENT: Machine<DeploymentState> = {
  id: 'deployment', initial: 'STOPPED', states: ['STOPPED', 'PROVISIONING', 'RUNNING', 'HEALTHY', 'DEGRADED', 'FROZEN'],
  transitions: { STOPPED: ['PROVISIONING'], PROVISIONING: ['RUNNING', 'STOPPED'], RUNNING: ['HEALTHY', 'DEGRADED', 'FROZEN', 'STOPPED'], HEALTHY: ['DEGRADED', 'FROZEN', 'STOPPED'], DEGRADED: ['HEALTHY', 'FROZEN', 'STOPPED'], FROZEN: ['STOPPED'] },
};
export const AUTONOMY: Machine<AutonomyState> = {
  id: 'autonomy', initial: 'L1_SHADOW', states: ['L1_SHADOW', 'L2_ASSISTED', 'L3_LIMITED_AUTONOMOUS', 'L4_AUTONOMOUS', 'L5_FOUNDER_DELEGATE'],
  transitions: { L1_SHADOW: ['L2_ASSISTED'], L2_ASSISTED: ['L3_LIMITED_AUTONOMOUS', 'L1_SHADOW'], L3_LIMITED_AUTONOMOUS: ['L4_AUTONOMOUS', 'L2_ASSISTED', 'L1_SHADOW'], L4_AUTONOMOUS: ['L5_FOUNDER_DELEGATE', 'L3_LIMITED_AUTONOMOUS', 'L2_ASSISTED', 'L1_SHADOW'], L5_FOUNDER_DELEGATE: ['L4_AUTONOMOUS', 'L3_LIMITED_AUTONOMOUS', 'L2_ASSISTED', 'L1_SHADOW'] },
};
export const MACHINES = { lifecycle: LIFECYCLE, deployment: DEPLOYMENT, autonomy: AUTONOMY } as const;
export type MachineId = keyof typeof MACHINES;

export const canTransition = (id: MachineId, from: string, to: string): boolean =>
  ((MACHINES[id].transitions as Record<string, readonly string[]>)[from] ?? []).includes(to);

/** Autonomy level number as used by contract.authority.autonomy_level (1..5). */
export const autonomyLevel = (a: AutonomyState): number => AUTONOMY.states.indexOf(a) + 1;
export const autonomyFromLevel = (n: number): AutonomyState => AUTONOMY.states[Math.min(4, Math.max(0, n - 1))];

/** Manifest schema still carries the v1.0 8-state `lifecycle_state` enum; derive it from the three v1.1 machines (G-07). */
export function manifestLifecycleState(l: LifecycleState, a: AutonomyState): string {
  switch (l) {
    case 'DRAFT': return 'CREATED';
    case 'VALIDATED': return 'CONFIGURED';
    case 'BENCHMARKED': return 'EVALUATED';
    case 'DEPRECATED': return 'DEPRECATED';
    case 'CERTIFIED': return a === 'L1_SHADOW' ? 'SHADOW' : a === 'L2_ASSISTED' ? 'ASSISTED' : a === 'L3_LIMITED_AUTONOMOUS' ? 'LIMITED_AUTONOMOUS' : 'AUTONOMOUS';
  }
}

/** §6.2.2: phase 1 = 20 synthetic tasks, 100% schema conformance; phase 2 = shadow match >= 95%. */
export const PROMOTION_GATE = { synthetic_total: 20, shadow_min: 0.95 } as const;
export const promotionReady = (p: { synthetic_passed: number; shadow_match_rate: number }) =>
  p.synthetic_passed >= PROMOTION_GATE.synthetic_total && p.shadow_match_rate >= PROMOTION_GATE.shadow_min;
