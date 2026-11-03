import type { RoleDefinition } from '../definitions';
import type { EmployeeTemplate } from '../definitions';

const tpl = (en: string, ar: string, mission: string, tools: [string, string][], level = 1, runtime = { max_concurrent_tasks: 5, task_timeout_seconds: 60 }): EmployeeTemplate => ({
  name: { en, ar }, mission, scope: tools.map(([, d]) => d), exclusions: ['Does not bypass the chain of authority', 'Does not commit funds without a founder token'],
  autonomy_level: level, tools: tools.map(([tool_id, description]) => ({ tool_id, description, is_idempotent: true })),
  policies: ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'], runtime,
  identity_prompt: `You are the ${en}. ${mission}`,
  skills: [{ name: `${en.toLowerCase().replace(/\W+/g, '_')}_playbook.md`, body: `---\nname: ${en}\nscope: ${mission}\n---\n# ${en}\n\n## Rules\n1. Validate every message against its schema before acting.\n2. Check the kill switch at the start of every cycle.\n\n## Decision rules\n- IF a schema check fails THEN reject and audit.\n` }],
  scorecard: ['routing_accuracy', 'sla_compliance'],
});

const defs: RoleDefinition[] = [
  { id: 'founder', kind: 'founder', category: 'Command', ref: '§1.2.1', label: { en: 'Human Founder', ar: 'المؤسس البشري' },
    description: { en: 'Sets objectives and decides escalations. Acts through a limited operator role; emergencies use a short-lived Ed25519 token.', ar: 'يحدد الأهداف ويبتّ في التصعيدات. يعمل عبر دور المشغّل المحدود، وللطوارئ رمز Ed25519 قصير الأجل.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'], schema_ref: 'objective_route',
    permissions: { grants: ['department:read', 'employee:status', 'metrics:read', 'task:inspect', 'audit:read'], prohibitions: ['funds:commit', 'storage:audit_modify', 'system:break_glass'], source: 'reference' } },
  { id: 'orchestrator', kind: 'orchestrator', category: 'Command', ref: '§3.1.1', label: { en: 'Departments Orchestrator', ar: 'منسّق الأقسام' },
    description: { en: 'core.orchestrator.v1 — validates objective routes and sends them to the right manager.', ar: 'core.orchestrator.v1 — يتحقق من حزم الأهداف ويوجهها للمدير المناسب.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract', network: 'internal',
    permissions: { grants: ['objective:route', 'department:control', 'model:invoke', 'audit:read'], prohibitions: [], source: 'reference' },
    employee: tpl('Departments Orchestrator', 'منسّق الأقسام', 'Receive objective routes, validate them, check kill switches and route them to the right manager.', [['route_objective', 'Route an objective to the right department manager']], 3) },
  { id: 'manager', kind: 'manager', category: 'Command', ref: '§3.1.2', label: { en: 'Department Manager', ar: 'مدير القسم' },
    description: { en: 'Runs the 9-step loop: dispatches tasks, monitors, validates, escalates to the founder.', ar: 'يدير الحلقة التساعية: يوزّع المهام ويراقب ويتحقق ويصعّد للمؤسس.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract', network: 'internal',
    permissions: { grants: ['model:invoke', 'task:dispatch', 'task:abort', 'escalation:create', 'audit:read', 'audit:write', 'storage:state_read', 'storage:state_write'], prohibitions: ['funds:commit_unauthorized'], source: 'reference' },
    employee: tpl('Department Manager', 'مدير القسم', 'Coordinate the department team, sequence tasks, manage the budget and run the 9-step loop.', [['dispatch_task', 'Dispatch a task to an employee'], ['build_escalation_package', 'Build an escalation package for the founder']], 3, { max_concurrent_tasks: 10, task_timeout_seconds: 120 }) },
];
export default defs;
