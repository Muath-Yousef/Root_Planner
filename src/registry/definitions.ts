import type { CableKind, DepartmentClass, Horizon, ImplementationStatus, NetworkMode, NodeKind, SkillFile, ZoneKind } from '../types';

export interface Localized { en: string; ar: string }
export type InspectorTab = 'identity' | 'contract' | 'manifest' | 'code' | 'tools' | 'policies' | 'context';
export type SchemaName = 'contract' | 'manifest' | 'task_dispatch' | 'task_result' | 'objective_route' | 'escalation_package';
export interface PortDef { id: string; cable: CableKind; direction: 'in' | 'out' }
export interface Match { kinds?: NodeKind[]; roles?: string[] }
export interface CableLink { from: Match; to: Match }

/** Everything an employee role needs to be instantiated. Contract fields follow contract.schema.json (§2.2.1). */
export interface EmployeeTemplate {
  name: Localized; mission: string; scope: string[]; exclusions: string[];
  autonomy_level: number;
  tools: { tool_id: string; description: string; is_idempotent: boolean }[];
  policies: string[];
  runtime: { max_concurrent_tasks: number; task_timeout_seconds: number };
  identity_prompt: string;
  skills: SkillFile[];
  secrets?: { name: string; ref: string }[];
  scorecard: string[];               // EVA-001 task-specific metrics
}

export interface RoleHelp {
  purpose: Localized;
  when_to_use: Localized;
  how_to_connect: Localized;
}

/**
 * One RoleDefinition file in src/registry/roles/ is all that is needed to add a role. The dock, canvas,
 * inspector and cabling validator read only these definitions; none of them names a role.
 */
export interface RoleDefinition {
  id: string; kind: NodeKind; category: string;
  label: Localized; description: Localized;
  architecture_horizon: Horizon; implementation_status: ImplementationStatus;
  inspector: InspectorTab[]; schema_ref?: SchemaName;
  network?: NetworkMode;
  /** Role may never own an EGRESS_NETWORK cable (POL_DRF_HARD_01 / ROLE_PROHIBITIONS web:*). */
  hard_no_egress?: boolean;
  /** §4.2.1. `source: 'derived'` marks roles the reference does not list in ROLE_PERMISSIONS (G-03). */
  permissions?: { grants: string[]; prohibitions: string[]; source: 'reference' | 'derived' };
  employee?: EmployeeTemplate;
  zone?: { zone: ZoneKind; isolation: NetworkMode; department_class?: DepartmentClass };
  memory_tier?: 'L1' | 'L2' | 'L3' | 'L4';
  ports?: PortDef[];
  ref?: string;                       // section of the reference
  help?: RoleHelp;
}
export interface CableDefinition { kind: CableKind; color: string; dashed?: boolean; dashArray?: string; patternName?: string; label: Localized; description: Localized; links: CableLink[] }
