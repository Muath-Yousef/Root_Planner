import type { Node, Edge } from '@xyflow/react';

/** §3 framing: horizons and implementation status use the reference's exact values. */
export type Horizon = 'CURRENT' | 'TRANSITIONAL' | 'TARGET';
export type ImplementationStatus = 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED' | 'TRIGGER_BASED' | 'DEPRECATED';
export type NetworkMode = 'internal' | 'isolated' | 'none';
/** TEN-002: standard = logical isolation (tenant_id + RLS); dedicated = physical isolation (TEN-004). */
export type IsolationMode = 'logical_rls' | 'dedicated';
export type Lang = 'en' | 'ar';
export type Theme = 'dark' | 'light';
export type Mode = 'design' | 'simulate';

export type NodeKind = 'founder' | 'orchestrator' | 'manager' | 'employee' | 'guard' | 'memory' | 'external' | 'zone';
export type CableKind = 'OBJECTIVE_ROUTE' | 'TASK_DISPATCH_RESULT' | 'ESCALATION_PATH' | 'MEMORY_BUS' | 'EGRESS_NETWORK' | 'KILL_PLANE_SIGNAL';
export type MemoryTier = 'L1' | 'L2' | 'L3' | 'L4';
export type ZoneKind = 'meta' | 'line' | 'docker' | 'untrusted';
export type DepartmentClass = 'OPERATIONAL_META' | 'FUNCTIONAL_LINE';

export interface SecretRef { name: string; ref: string }
export interface SkillFile { name: string; body: string }

/** LIF-001 / §6.9.1: three independent state machines. */
export type LifecycleState = 'DRAFT' | 'VALIDATED' | 'BENCHMARKED' | 'CERTIFIED' | 'DEPRECATED';
export type DeploymentState = 'STOPPED' | 'PROVISIONING' | 'RUNNING' | 'HEALTHY' | 'DEGRADED' | 'FROZEN';
export type AutonomyState = 'L1_SHADOW' | 'L2_ASSISTED' | 'L3_LIMITED_AUTONOMOUS' | 'L4_AUTONOMOUS' | 'L5_FOUNDER_DELEGATE';

/** EVA-001 + §6.2.2: promotion evidence, with a role-specific scorecard. */
export interface PromotionCard {
  synthetic_passed: number;       // of 20 synthetic benchmark tasks, schema-conformant (phase 1)
  shadow_match_rate: number;      // 0..1, phase 2 (>= 0.95 required)
  scorecard: Record<string, number>; // role-specific metrics, 0..1
}

export interface EmployeeConfig {
  contract: Record<string, unknown>;   // validated by contract.schema.json
  manifest: Record<string, unknown>;   // validated by manifest.schema.json
  lifecycle: LifecycleState;
  deployment: DeploymentState;
  autonomy: AutonomyState;
  promotion: PromotionCard;
  secrets: SecretRef[];                // SEC-001: vault:// references only
  skills: SkillFile[];
  custom_code: string;                 // editable body of Employee.run; the embedded PEP is generated and locked
}

export interface ZoneConfig { zone: ZoneKind; isolation: NetworkMode; department_id?: string; department_class?: DepartmentClass }

export interface NodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  role: string;
  networkMode?: NetworkMode;
  status: ImplementationStatus;
  employee?: EmployeeConfig;
  zone?: ZoneConfig;
}
export type SNode = Node<NodeData>;
export interface EdgeData extends Record<string, unknown> { kind: CableKind; access?: 'read' | 'write' }
export type SEdge = Edge<EdgeData>;

export interface Verdict_OK { ok: true }
export interface Verdict_Deny { ok: false; code: string; reason: string; fix?: string }
export type Verdict = Verdict_OK | Verdict_Deny;
