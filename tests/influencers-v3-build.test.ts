import { describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeEmployeeConfig, templateNodeData } from '../src/engine/employeeFactory';
import { checkCable } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import { MODEL_ROUTING_YAML, PRICING_CONFIG_YAML } from '../src/presets/referenceConfigs';
import { CURRENT_FORMAT_VERSION } from '../src/schemas/project';
import { getRole, mkEdge } from '../src/registry';
import type { RoleDefinition } from '../src/registry/definitions';
import type { CableKind, ProjectFile, SEdge, SNode } from '../src/types';
import influencerRoleDefs from '../src/registry/roles/influencer';

/**
 * Influencer system topology v3 for Root Planner (socroot-topology-studio, format v2).
 * Recovered into the repo in Phase 0 (plan: root-planner-improvement-plan.md).
 * v2 (29 nodes / 43 edges, one influencer's production line) is untouched; v3
 * extends it to the PORTFOLIO the founder asked for on 7 Nov 2026 ("multiple
 * influencers"): three influencer lines inside the same department, over one
 * shared platform. The number of lines is a template parameter (LINE_COUNT);
 * three demonstrates the portfolio mechanics without clutter, and changing it
 * regenerates the file — no influencer is named, no field/persona/language/
 * platform is decided (still founder decisions, still open). The delivered
 * file is examples/influencers_system_v3.socroot.json and its governing hash
 * is EXPECTED_SHA256 below.
 *
 *   shared platform    scout + collector + transformer + context + custodian
 *                      + evaluator + strategist (one data pipeline, one L2
 *                      database, one L3 semantic layer)
 *   per line (x3)      content_selector + creator + drafter + creator_profile
 *                      (each line's own angle choice, persona, scripts, profile)
 *   shared operations  publisher + compliance + income_mgr + perf_analyst
 *                      (one publisher, one disclosure check, one income
 *                      manager over three income registers, one analyst)
 *   per-line safety    kill reaches each creator separately, so one line can
 *                      be halted without stopping the other two.
 *
 * Roles: no new roles. The three v2 custom roles (collector, content_selector,
 * creator) are reused — one employee instance per line, each with its own
 * employee_id (inf.<role>_<line>.v1). Since Phase 4 they are registered
 * registry roles (src/registry/roles/influencer.ts); the drift test guards
 * them here too.
 *
 * Permission honesty (same studio rules as v2): custom roles keep
 * model:invoke + task:* only, so they use MEMORY_BUS to L1 only. The creator
 * profiles are L2 memories: written by the strategist (storage:state_write)
 * and read by the registry roles (drafter, evaluator, compliance, analyst).
 * The selector and the creator have NO profile edge — the studio's own
 * memoryPermitted() would reject it, exactly as in v2. The income registers
 * are likewise L2: the transformer writes income observations into each
 * line's register, the income manager and the analyst read them.
 */

const DEPT = 'dept_influencer_system';
const TENANT_ID = 'socroot-core';
const LINE_COUNT = 3;
const OUT_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v3.socroot.json');
/** Governing hash of the delivered v3 file (7 Nov 2026, deterministic build). */
const EXPECTED_SHA256 = 'ac9f04781e22f0de54a0ebc04a00133ee861c6525274c48aeb26bd2be0256ed1';

const INFLUENCER_WATCHLIST_YAML = `# config/sources_watchlist.yaml — influencer system (Instagram only)
# Approved source is Instagram only at this stage (founder decision, 25 Oct 2026).
# The database's 15-group source registry is a separate register; it does not widen this allowlist.
blocked_ip_ranges:
  - "10.0.0.0/8"         # RFC 1918 — private networks
  - "172.16.0.0/12"      # RFC 1918
  - "192.168.0.0/16"     # RFC 1918
  - "127.0.0.0/8"        # Loopback
  - "169.254.169.254/32" # AWS/GCP IMDS
  - "fd00::/8"           # IPv6 ULA

approved_sources:
  instagram:
    name:   "Instagram"
    domain: "instagram.com"
    paths:  ["/"]

constraints:
  max_timeout:         10
  max_response_size:   5242880
  methods:             [GET, HEAD]
`;

const sk = (name: string, title: string, rules: string[]) => ({ name, body: `---\nname: ${name.replace('.md', '')}\nscope: ${title}\n---\n# ${title}\n\n## Rules\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n## Decision rules\n- IF evidence is missing THEN treat the criterion as not met (fail-closed).\n- IF the request is outside this role's scope THEN escalate to the manager.\n` });

/** Custom roles, in the registry's own RoleDefinition shape (cf. src/registry/roles/employees.ts emp()). */
const CUSTOM_ROLES: Record<string, RoleDefinition> = {
  collector: {
    id: 'collector', kind: 'employee', category: 'Employees', ref: 'influencer-system v2 (custom role)',
    label: { en: 'Collector', ar: 'جامع البيانات' },
    description: { en: 'Collects structured candidate data about AI influencers and lands it unchanged in the raw working memory (L1).', ar: 'يجمع بيانات مرشحين منظمة عن مؤثري الذكاء الاصطناعي ويودعها دون تغيير في الذاكرة الخام (L1).' },
    architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED',
    inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract',
    network: 'internal',
    permissions: { grants: ['model:invoke', 'task:read', 'task:complete'], prohibitions: ['web:*', 'external:*', 'funds:*', 'storage:audit_modify'], source: 'derived' },
    employee: {
      name: { en: 'Collector', ar: 'جامع البيانات' },
      mission: 'Collect structured candidate data about AI influencers from the findings the Scout reports through the manager, and land it unchanged in the raw working memory (L1).',
      scope: ['Receive collection tasks from the manager only', 'Write raw records to L1 working memory', 'Preserve source links and collection dates on every record', 'Never invent a field, a follower count or an income figure'],
      exclusions: ['Does not contact the web or any external party', 'Does not decide what enters the database (the transformer and the custodian decide)', 'Does not publish anything'],
      autonomy_level: 1,
      tools: [
        { tool_id: 'land_raw_record', description: 'Land a raw influencer record in L1 with source and date', is_idempotent: true },
        { tool_id: 'normalize_record_fields', description: 'Normalize field names without changing values', is_idempotent: true },
      ],
      policies: ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
      runtime: { max_concurrent_tasks: 5, task_timeout_seconds: 60 },
      identity_prompt: 'You are the Collector of the influencer system. You collect structured candidate data about AI influencers from the Scout findings handed to you by the manager, and you land it unchanged in the raw working memory (L1). Rely on objective evidence only. Never invent a field, a follower count or an income figure.',
      skills: [sk('collector_playbook.md', 'Collector playbook', ['Stay inside the collector role.', 'Cite the evidence behind every conclusion.', 'Never include unverified numbers.'])],
      scorecard: ['field_completeness', 'source_link_present', 'zero_invented_values'],
    },
  },
  content_selector: {
    id: 'content_selector', kind: 'employee', category: 'Employees', ref: 'influencer-system v2 (custom role)',
    label: { en: 'Content Selector', ar: 'مختار المحتوى' },
    description: { en: 'Selects the content angle for the next production cycle from the strategist’s ranked angles and the creator profile.', ar: 'يختار زاوية المحتوى لدورة الإنتاج التالية من الزوايا المرتبة للاستراتيجي وملف صانع المحتوى.' },
    architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED',
    inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract',
    network: 'internal',
    permissions: { grants: ['model:invoke', 'task:read', 'task:complete'], prohibitions: ['web:*', 'external:*', 'funds:*', 'storage:audit_modify'], source: 'derived' },
    employee: {
      name: { en: 'Content Selector', ar: 'مختار المحتوى' },
      mission: 'Select the content angle for the next production cycle from the ranked angles the strategist prepared and the creator profile, and propose the selection to the manager.',
      scope: ['Receive ranked angles from the manager', 'Propose one selected angle with its evidence to the manager', 'Keep the selection inside the creator profile (niche, voice, pillars)', 'Never invent audience numbers or performance claims'],
      exclusions: ['Does not set the creator niche, persona or language (founder decisions)', 'Does not write the creator profile (the strategist does)', 'Does not write scripts (the drafter does)', 'Does not publish'],
      autonomy_level: 1,
      tools: [
        { tool_id: 'propose_angle', description: 'Propose a selected content angle with its evidence', is_idempotent: true },
        { tool_id: 'check_profile_fit', description: 'Check an angle against the creator profile', is_idempotent: true },
      ],
      policies: ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
      runtime: { max_concurrent_tasks: 5, task_timeout_seconds: 60 },
      identity_prompt: 'You are the Content Selector of the influencer system. You select the content angle for the next production cycle from the ranked angles the strategist prepared and the creator profile, and you propose the selection to the manager. Rely on objective evidence only. Never invent audience numbers or performance claims.',
      skills: [sk('content_selector_playbook.md', 'Content Selector playbook', ['Stay inside the content_selector role.', 'Cite the evidence behind every conclusion.', 'Never include unverified numbers.'])],
      scorecard: ['profile_fit', 'evidence_cited', 'selection_grounding'],
    },
  },
  creator: {
    id: 'creator', kind: 'employee', category: 'Employees', ref: 'influencer-system v2 (custom role)',
    label: { en: 'Creator', ar: 'صانع المحتوى' },
    description: { en: 'Embodies the creator persona defined in its contract and performs the drafted content for human review. Niche, persona, language and platform are founder decisions, still open.', ar: 'يجسّد شخصية صانع المحتوى المحددة في عقده ويؤدي المحتوى المصوغ للمراجعة البشرية. المجال والشخصية واللغة والمنصة قرارات مؤسس لم تُحسم بعد.' },
    architecture_horizon: 'TRANSITIONAL', implementation_status: 'PLANNED',
    inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract',
    network: 'internal',
    permissions: { grants: ['model:invoke', 'task:read', 'task:complete'], prohibitions: ['web:*', 'external:*', 'funds:*', 'storage:audit_modify'], source: 'derived' },
    employee: {
      name: { en: 'Creator', ar: 'صانع المحتوى' },
      mission: 'Embody the creator persona defined in this contract (niche, voice, content pillars, offers) as decided by the founder, and perform the drafted content for human review.',
      scope: ['Perform drafted scripts as the persona', 'Keep voice and character consistent with the creator profile', 'Escalate any conflict between a script and the persona to the manager'],
      exclusions: ['Does not choose its own niche, persona, language or platform (founder decisions, still open)', 'Does not write scripts (the drafter does)', 'Does not publish (the publisher does, after human review)', 'Does not contact the web'],
      autonomy_level: 1,
      tools: [
        { tool_id: 'perform_script', description: 'Perform a drafted script as the persona for review', is_idempotent: true },
        { tool_id: 'check_voice_consistency', description: 'Check a performance against the creator profile', is_idempotent: true },
      ],
      policies: ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
      runtime: { max_concurrent_tasks: 5, task_timeout_seconds: 60 },
      identity_prompt: 'You are the Creator of the influencer system. You embody the creator persona defined in your contract (niche, voice, content pillars, offers) as decided by the founder, and you perform the drafted content for human review. Your niche, persona, language and platform are founder decisions and are still open: never choose them yourself. Rely on objective evidence only.',
      skills: [sk('creator_playbook.md', 'Creator playbook', ['Stay inside the creator role.', 'Never choose the niche, persona, language or platform yourself.', 'Never include unverified numbers.'])],
      scorecard: ['voice_consistency', 'profile_adherence', 'review_pass_rate'],
    },
  },
};

type Status = SNode['data']['status'];

const STATUS: Record<string, Status> = {
  founder: 'IMPLEMENTED',
  orch: 'PLANNED',
  zone_dept: 'PLANNED',
  mgr: 'PLANNED',
  scout: 'PLANNED',
  collector: 'PLANNED',
  transformer: 'PLANNED',
  ctx: 'PLANNED',
  custodian: 'PLANNED',
  eva: 'PLANNED',
  str: 'PLANNED',
  content_selector_1: 'PLANNED',
  content_selector_2: 'PLANNED',
  content_selector_3: 'PLANNED',
  creator_1: 'PLANNED',
  creator_2: 'PLANNED',
  creator_3: 'PLANNED',
  drf_1: 'PLANNED',
  drf_2: 'PLANNED',
  drf_3: 'PLANNED',
  publisher: 'PLANNED',
  compliance: 'PLANNED',
  income_mgr: 'PLANNED',
  perf_analyst: 'PLANNED',
  ssrf: 'IMPLEMENTED',
  l1: 'PLANNED',
  l2: 'IMPLEMENTED',
  l3: 'PLANNED',
  creator_profile_1: 'PLANNED',
  creator_profile_2: 'PLANNED',
  creator_profile_3: 'PLANNED',
  income_register_1: 'PLANNED',
  income_register_2: 'PLANNED',
  income_register_3: 'PLANNED',
  pe: 'IMPLEMENTED',
  bg: 'IMPLEMENTED',
  kill: 'IMPLEMENTED',
  zone_web: 'IMPLEMENTED',
  web: 'PLANNED',
};

const LABELS: Record<string, string> = {
  founder: 'المؤسس',
  orch: 'المنسق',
  zone_dept: DEPT,
  mgr: 'مدير قطاع المؤثرين',
  scout: 'المستطلع',
  collector: 'جامع بيانات المؤثرين',
  transformer: 'مهندس تحويل البيانات',
  ctx: 'السياق',
  custodian: 'أمين قاعدة البيانات',
  eva: 'المقيّم',
  str: 'الاستراتيجي',
  content_selector_1: 'مختار المحتوى 1',
  content_selector_2: 'مختار المحتوى 2',
  content_selector_3: 'مختار المحتوى 3',
  creator_1: 'صانع المحتوى 1',
  creator_2: 'صانع المحتوى 2',
  creator_3: 'صانع المحتوى 3',
  drf_1: 'الصائغ 1',
  drf_2: 'الصائغ 2',
  drf_3: 'الصائغ 3',
  publisher: 'الناشر',
  compliance: 'مراجع الامتثال والإفصاح',
  income_mgr: 'مدير مصادر الدخل',
  perf_analyst: 'محلل الأداء والدخل',
  ssrf: 'حارس SSRF ووكيل الخروج',
  l1: 'L1 — البيانات الخام',
  l2: 'L2 — قاعدة بيانات المؤثرين',
  l3: 'L3 — الذاكرة الدلالية',
  creator_profile_1: 'L2 — ملف صانع المحتوى 1',
  creator_profile_2: 'L2 — ملف صانع المحتوى 2',
  creator_profile_3: 'L2 — ملف صانع المحتوى 3',
  income_register_1: 'L2 — سجل مصادر الدخل 1',
  income_register_2: 'L2 — سجل مصادر الدخل 2',
  income_register_3: 'L2 — سجل مصادر الدخل 3',
  pe: 'محرك السياسات',
  bg: 'حارس الميزانية',
  kill: 'قاطع الطوارئ',
  zone_web: 'العالم غير الموثوق',
  web: 'Instagram',
};

/** Registry roles used by the new nodes (v1 roles are scout/context/evaluator/strategist/drafter). */
const ROLE_OF: Record<string, string> = {
  transformer: 'systems_engineer',
  custodian: 'knowledge_custodian',
  publisher: 'integration_spec',
  income_mgr: 'financial_controller',
  perf_analyst: 'performance_analyst',
  compliance: 'compliance',
};

export function buildInfluencerV3Topology(tenant_id = TENANT_ID, now = new Date().toISOString()): { nodes: SNode[]; edges: SEdge[] } {
  const o = (prefix: string) => ({
    prefix,
    department: DEPT,
    manager_id: 'inf.manager.v1',
    tenant_id,
    created_at: now,
  });
  const mk = (id: string, role: string, x: number, y: number, extra: Partial<SNode> = {}, opts: Record<string, unknown> = {}): SNode =>
    ({
      id,
      type: role.startsWith('zone_') ? 'zone' : 'studio',
      position: { x, y },
      data: templateNodeData(role, {
        ...(role.startsWith('zone_') ? {} : o(String(opts.prefix ?? 'inf'))),
        ...opts,
      }),
      ...extra,
    }) as SNode;
  const mkCustom = (id: string, x: number, y: number, extra: Partial<SNode> = {}): SNode => {
    const def = CUSTOM_ROLES[id];
    const data = {
      label: LABELS[id],
      kind: 'employee',
      role: def.id,
      networkMode: def.network ?? 'internal',
      status: 'PLANNED' as Status,
      employee: makeEmployeeConfig(def, { prefix: 'inf', department: DEPT, manager_id: 'inf.manager.v1', tenant_id, created_at: now }),
    };
    return { id, type: 'studio', position: { x, y }, data, ...extra } as unknown as SNode;
  };
  /** One employee instance of a custom role on a given line (own employee_id). */
  const mkLine = (instanceId: string, roleId: string, line: number, x: number, y: number, extra: Partial<SNode> = {}): SNode => {
    const def = CUSTOM_ROLES[roleId];
    const data = {
      label: LABELS[instanceId],
      kind: 'employee',
      role: def.id,
      networkMode: def.network ?? 'internal',
      status: 'PLANNED' as Status,
      employee: makeEmployeeConfig(def, {
        prefix: 'inf', department: DEPT, manager_id: 'inf.manager.v1', tenant_id, created_at: now,
        employee_id: `inf.${roleId}_${line}.v1`, name: `${def.employee!.name.en} ${line}`,
      }),
    };
    return { id: instanceId, type: 'studio', position: { x, y }, data, ...extra } as unknown as SNode;
  };
  const zone = mk('zone_dept', 'zone_line', 470, -40, { style: { width: 2160, height: 784 }, zIndex: -1 }, { label: DEPT });
  zone.data = { ...zone.data, zone: { ...zone.data.zone!, department_id: DEPT } };
  const child = (id: string, role: string, x: number, y: number) => mk(id, role, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const childOpts = (id: string, role: string, x: number, y: number, opts: Record<string, unknown>) => mk(id, role, x, y, { parentId: 'zone_dept', extent: 'parent' }, opts);
  const childCustom = (id: string, x: number, y: number) => mkCustom(id, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const childLine = (instanceId: string, roleId: string, line: number, x: number, y: number) => mkLine(instanceId, roleId, line, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const untrusted = mk('zone_web', 'zone_untrusted', 3020, -30, { style: { width: 260, height: 200 }, zIndex: -1 });
  const lines = Array.from({ length: LINE_COUNT }, (_, i) => i + 1);
  const nodes: SNode[] = [
    mk('founder', 'founder', 0, 300),
    mk('orch', 'orchestrator', 230, 300, {}, { prefix: 'core' }),
    zone,
    child('mgr', 'manager', 30, 340),
    // Shared platform — stage 1: scouting & collection
    child('scout', 'scout', 320, 0),
    childCustom('collector', 320, 170),
    child('transformer', ROLE_OF.transformer, 320, 340),
    // Shared platform — stage 2: data & context
    child('ctx', 'context', 640, 0),
    child('custodian', ROLE_OF.custodian, 640, 170),
    child('eva', 'evaluator', 640, 340),
    // Shared strategist (ranks angles for all lines)
    child('str', 'strategist', 960, 0),
    // One production line per influencer: selector -> creator -> drafter -> profile
    ...lines.flatMap((n) => [
      childLine(`content_selector_${n}`, 'content_selector', n, 960, 170 + (n - 1) * 170),
      childLine(`creator_${n}`, 'creator', n, 1280, 170 + (n - 1) * 170),
      childOpts(`drf_${n}`, 'drafter', 1600, 170 + (n - 1) * 170, { employee_id: `inf.drafter_${n}.v1`, name: `Drafter ${n}` }),
      child(`creator_profile_${n}`, 'l2', 1920, 170 + (n - 1) * 170),
    ]),
    // Shared operations (bottom row)
    child('publisher', ROLE_OF.publisher, 960, 680),
    child('compliance', ROLE_OF.compliance, 1280, 680),
    child('income_mgr', ROLE_OF.income_mgr, 1600, 680),
    child('perf_analyst', ROLE_OF.perf_analyst, 1920, 680),
    // Infrastructure (right column)
    mk('ssrf', 'ssrf_guard', 2760, 0),
    mk('l1', 'l1', 2760, 170),
    mk('l2', 'l2', 2760, 340),
    mk('l3', 'l3', 2760, 510),
    ...lines.map((n) => mk(`income_register_${n}`, 'l2', 2760, 510 + n * 170)),
    mk('pe', 'policy_engine', 2760, 1190),
    mk('bg', 'budget_guard', 2760, 1360),
    untrusted,
    { ...mk('web', 'external', 40, 70), parentId: 'zone_web', extent: 'parent' },
    mk('kill', 'kill_switch', 470, 950),
  ];
  for (const n of nodes) {
    n.data.label = LABELS[n.id] ?? n.data.label;
    n.data.status = STATUS[n.id] ?? n.data.status;
  }
  const e = (s: string, t: string, k: CableKind, a?: 'read' | 'write') => mkEdge(s, t, k, a);
  const EMPLOYEES = [
    'scout', 'collector', 'transformer', 'ctx', 'custodian', 'eva', 'str',
    ...lines.flatMap((n) => [`content_selector_${n}`, `creator_${n}`, `drf_${n}`]),
    'publisher', 'compliance', 'income_mgr', 'perf_analyst',
  ];
  const edges: SEdge[] = [
    e('founder', 'orch', 'OBJECTIVE_ROUTE'),
    e('orch', 'mgr', 'OBJECTIVE_ROUTE'),
    ...EMPLOYEES.map((id) => e('mgr', id, 'TASK_DISPATCH_RESULT')),
    e('mgr', 'founder', 'ESCALATION_PATH'),
    e('scout', 'ssrf', 'EGRESS_NETWORK'),
    e('ssrf', 'web', 'EGRESS_NETWORK'),
    e('publisher', 'ssrf', 'EGRESS_NETWORK'),
    // Raw layer in, structured data out (shared platform)
    e('scout', 'l1', 'MEMORY_BUS', 'write'),
    e('collector', 'l1', 'MEMORY_BUS', 'write'),
    e('transformer', 'l1', 'MEMORY_BUS', 'read'),
    e('transformer', 'l2', 'MEMORY_BUS', 'write'),
    ...lines.map((n) => e('transformer', `income_register_${n}`, 'MEMORY_BUS', 'write')),
    e('custodian', 'l2', 'MEMORY_BUS', 'read'),
    e('custodian', 'l3', 'MEMORY_BUS', 'write'),
    // Creator profiles: strategist writes each line's profile; registry roles read it
    ...lines.map((n) => e('str', `creator_profile_${n}`, 'MEMORY_BUS', 'write')),
    ...lines.map((n) => e(`drf_${n}`, `creator_profile_${n}`, 'MEMORY_BUS', 'read')),
    ...lines.map((n) => e('eva', `creator_profile_${n}`, 'MEMORY_BUS', 'read')),
    ...lines.map((n) => e('compliance', `creator_profile_${n}`, 'MEMORY_BUS', 'read')),
    ...lines.map((n) => e('perf_analyst', `creator_profile_${n}`, 'MEMORY_BUS', 'read')),
    // Evaluation reads the database
    e('eva', 'l2', 'MEMORY_BUS', 'read'),
    e('compliance', 'l2', 'MEMORY_BUS', 'read'),
    // Income registers: one per line; money roles read them
    ...lines.map((n) => e('income_mgr', `income_register_${n}`, 'MEMORY_BUS', 'read')),
    e('income_mgr', 'l2', 'MEMORY_BUS', 'read'),
    ...lines.map((n) => e('perf_analyst', `income_register_${n}`, 'MEMORY_BUS', 'read')),
    e('perf_analyst', 'l2', 'MEMORY_BUS', 'read'),
    // Context and strategy reads (v1, kept)
    e('ctx', 'l3', 'MEMORY_BUS', 'read'),
    e('str', 'l2', 'MEMORY_BUS', 'read'),
    // Kill plane: manager + publisher + each creator separately (per-line halt)
    e('kill', 'mgr', 'KILL_PLANE_SIGNAL'),
    e('kill', 'publisher', 'KILL_PLANE_SIGNAL'),
    ...lines.map((n) => e('kill', `creator_${n}`, 'KILL_PLANE_SIGNAL')),
  ];
  return { nodes, edges };
}

export function buildInfluencerV3Project(now = new Date().toISOString()): ProjectFile {
  // Deterministic build: the factory stamps each manifest with the
  // created_at passed in the factory options, so the file hash identifies
  // the topology, not the build minute.
  const { nodes, edges } = buildInfluencerV3Topology(TENANT_ID, now);
  return {
    format_version: CURRENT_FORMAT_VERSION,
    app: 'socroot-topology-studio',
    id: 'proj-influencers-system-v3',
    name: 'منظومة المؤثرين (v3)',
    tenant: { tenant_id: TENANT_ID, isolation: 'logical_rls', name: 'Sovereign Core' },
    horizon: 'TRANSITIONAL',
    created_at: now,
    updated_at: now,
    nodes,
    edges,
    configs: {
      model_routing: MODEL_ROUTING_YAML,
      sources_watchlist: INFLUENCER_WATCHLIST_YAML,
      pricing_config: PRICING_CONFIG_YAML,
    },
  };
}

describe('influencer system topology v3 (portfolio of 3 lines, 7 Nov 2026)', () => {
  const project = buildInfluencerV3Project('2026-11-07T06:19:00.000Z');
  const { nodes, edges } = project;
  const byId = (id: string) => nodes.find((n) => n.id === id)!;
  const lines = [1, 2, 3];

  it('has 39 nodes and 67 edges with stable ids', () => {
    expect(nodes).toHaveLength(39);
    expect(edges).toHaveLength(67);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(39);
    expect(edges.every((x) => byId(x.source) && byId(x.target))).toBe(true);
  });

  it('covers the portfolio: one shared platform, three lines, shared operations', () => {
    const shared: Record<string, string[]> = {
      scouting: ['scout', 'collector'],
      database: ['l1', 'transformer', 'l2', 'custodian', 'l3'],
      operations: ['publisher', 'compliance'],
      income_sources: ['income_mgr'],
      income_outcome: ['perf_analyst'],
    };
    for (const [name, ids] of Object.entries(shared)) {
      for (const id of ids) expect(byId(id), `${name}: ${id}`).toBeTruthy();
    }
    // Each line is a full production cell: selector -> creator -> drafter -> profile, plus its income register.
    for (const n of lines) {
      for (const id of [`content_selector_${n}`, `creator_${n}`, `drf_${n}`, `creator_profile_${n}`, `income_register_${n}`]) {
        expect(byId(id), `line ${n}: ${id}`).toBeTruthy();
      }
      expect(byId(`creator_${n}`).data.role).toBe('creator');
      expect(byId(`content_selector_${n}`).data.role).toBe('content_selector');
    }
  });

  it('uses honest statuses: 7 implemented, the rest planned', () => {
    const implemented = nodes.filter((n) => n.data.status === 'IMPLEMENTED').map((n) => n.id).sort();
    expect(implemented).toEqual(['bg', 'founder', 'kill', 'l2', 'pe', 'ssrf', 'zone_web']);
    expect(nodes.filter((n) => n.data.status === 'PLANNED')).toHaveLength(32);
  });

  it('custom roles carry embedded contracts, one instance per line', () => {
    // Registered since Phase 4 (was: getRole returned undefined).
    expect(getRole('collector')).toEqual(CUSTOM_ROLES['collector']);
    for (const n of lines) {
      for (const role of ['content_selector', 'creator']) {
        const id = `${role}_${n}`;
        expect(getRole(role)).toEqual(CUSTOM_ROLES[role]);
        const node = byId(id);
        expect(node.data.employee, id).toBeTruthy();
        const contract = node.data.employee!.contract as { employee_id: string; role: string };
        expect(contract.employee_id).toBe(`inf.${role}_${n}.v1`);
        expect(contract.role).toBe(role);
        if (role === 'creator') {
          const c = node.data.employee!.contract as { exclusions: string[] };
          expect(c.exclusions.join(' ')).toMatch(/founder decisions, still open/);
        }
      }
      // The drafter is a registry role, but each line has its own instance id.
      const d = byId(`drf_${n}`).data.employee!.contract as { employee_id: string; role: string };
      expect(d.employee_id).toBe(`inf.drafter_${n}.v1`);
      expect(d.role).toBe('drafter');
    }
    // The single shared collector keeps its v2 identity.
    const c = byId('collector').data.employee!.contract as { employee_id: string };
    expect(c.employee_id).toBe('inf.collector.v1');
  });

  it('installed registry roles match the embedded custom roles', () => {
    expect(influencerRoleDefs).toEqual(Object.values(CUSTOM_ROLES));
  });

  it('every cable passes the studio validator', () => {
    for (const e of edges) {
      const r = checkCable(byId(e.source), byId(e.target), e.data!.kind, e.data!.access);
      expect(r.verdict.ok, `${e.id}: ${r.verdict.ok ? '' : r.verdict.reason}`).toBe(true);
    }
  });

  it('imports through the studio import path with zero errors', () => {
    const text = serializeProject(project);
    const parsed = parseProjectText(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.migrated_from).toBeNull();
    const problems = collectProblems(nodes, edges, { tenant_id: TENANT_ID });
    expect(errorCount(problems)).toBe(0);
    const warnings = problems.filter((p) => p.severity === 'warning');
    // 20 employees + the manager, all inside the PLANNED department (v2: 14 + 1 = 15).
    expect(warnings).toHaveLength(21);
    expect(new Set(warnings.map((w) => w.code))).toEqual(new Set(['ORG-003']));
  });

  it('writes the deliverable file and re-reads it clean', () => {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    const text = serializeProject(project);
    fs.writeFileSync(OUT_PATH, `${text}\n`);
    const back = parseProjectText(fs.readFileSync(OUT_PATH, 'utf-8'));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.project.nodes).toHaveLength(39);
      expect(back.project.edges).toHaveLength(67);
      expect(back.project.horizon).toBe('TRANSITIONAL');
      expect(back.project.id).toBe('proj-influencers-system-v3');
    }
    // The regenerated file must be byte-identical to the delivered one.
    const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT_PATH)).digest('hex');
    expect(sha).toBe(EXPECTED_SHA256);
  });
});
