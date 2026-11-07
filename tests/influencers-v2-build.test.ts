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
import influencerRoleDefs from '../examples/influencer_roles';

/**
 * Influencer system topology v2 for Root Planner (socroot-topology-studio, format v2).
 * Recovered into the repo in Phase 0 (plan: root-planner-improvement-plan.md).
 * It was first built on 7 Nov 2026 as a vitest generator outside the repo; the
 * delivered file is examples/influencers_system_v2.socroot.json and its
 * governing hash is EXPECTED_SHA256 below. v1 (17 nodes / 13 edges,
 * founder-approved skeleton) is untouched; v2 extends it to cover the full
 * pipeline the founder asked for on 7 Nov 2026:
 *
 *   1. scouting            scout + collector            (find + collect candidates)
 *   2. database            L1 raw -> transformer -> L2, custodian -> L3
 *                          (raw layer, ETL into Postgres, semantic curation)
 *   3. content choice      content_selector             (pick the angle)
 *   4. creator spec        creator + creator_profile    (persona, pillars, offers)
 *   5. income sources      financial_controller + income_register
 *   6. operations          publisher (integration_spec) + compliance
 *                          (publish via the registered Instagram integration,
 *                           pre-publish disclosure/AI-label check)
 *   7. income outcome      performance_analyst          (measure revenue, feed back)
 *
 * Roles: nine new employees. Six are registry roles (integration_spec,
 * systems_engineer, knowledge_custodian, financial_controller,
 * performance_analyst, compliance). Three are CUSTOM roles the studio's
 * registry does not have yet — collector, content_selector, creator — built
 * here with makeEmployeeConfig from hand-written RoleDefinitions, exactly the
 * shape the registry's own emp() helper produces. Their contracts are
 * embedded in the file, so the file imports and validates with zero errors.
 *
 * Permission honesty (the studio's own rules, verified in code):
 * - NodeData.role and the contract schema accept any string; the AJV project
 *   schema does not restrict roles to an enum.
 * - isPermitted() default-denies unknown roles, and memoryPermitted() allows
 *   L1 read/write unconditionally but requires storage:state_* for L2 and
 *   storage:vector_* for L3. So custom roles can use TASK_DISPATCH_RESULT,
 *   ESCALATION_PATH, KILL_PLANE_SIGNAL and MEMORY_BUS to L1 only. They have
 *   no egress (only web:read roles — Scout, Context, Integration Specialist
 *   — may reach SSRFGuard) and no L2/L3 access. That is why the publisher
 *   is integration_spec (web:read) and the L2 writers are registry roles
 *   with storage:state_write (transformer, strategist).
 * - The creator's niche/persona/language/platform are NOT in any contract:
 *   they are founder decisions, still open. The creator contract says so.
 * - To make the three custom roles first-class (dock + inspector +
 *   permissions), add one RoleDefinition file to src/registry/roles/ and
 *   register it in src/registry/index.ts — the studio's own extension point
 *   ("one RoleDefinition file is all that is needed to add a role"). That
 *   patch is prepared separately (examples/influencer_roles.ts) and is NOT
 *   applied to the repo by this file.
 */

const DEPT = 'dept_influencer_system';
const TENANT_ID = 'socroot-core';
const OUT_PATH = path.join(process.cwd(), 'examples', 'influencers_system_v2.socroot.json');
/** Governing hash of the delivered v2 file (7 Nov 2026, deterministic build). */
const EXPECTED_SHA256 = 'b035d53207c1e7c033ef2d7c474a5b188213441762189568ccb219b6db34fcc1';

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
  content_selector: 'PLANNED',
  creator: 'PLANNED',
  drf: 'PLANNED',
  publisher: 'PLANNED',
  compliance: 'PLANNED',
  income_mgr: 'PLANNED',
  perf_analyst: 'PLANNED',
  ssrf: 'IMPLEMENTED',
  l1: 'PLANNED',
  l2: 'IMPLEMENTED',
  l3: 'PLANNED',
  creator_profile: 'PLANNED',
  income_register: 'PLANNED',
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
  content_selector: 'مختار المحتوى',
  creator: 'صانع المحتوى',
  drf: 'الصائغ',
  publisher: 'الناشر',
  compliance: 'مراجع الامتثال والإفصاح',
  income_mgr: 'مدير مصادر الدخل',
  perf_analyst: 'محلل الأداء والدخل',
  ssrf: 'حارس SSRF ووكيل الخروج',
  l1: 'L1 — البيانات الخام',
  l2: 'L2 — قاعدة بيانات المؤثرين',
  l3: 'L3 — الذاكرة الدلالية',
  creator_profile: 'L2 — ملف صانع المحتوى',
  income_register: 'L2 — سجل مصادر الدخل',
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

export function buildInfluencerV2Topology(tenant_id = TENANT_ID, now = new Date().toISOString()): { nodes: SNode[]; edges: SEdge[] } {
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
  const zone = mk('zone_dept', 'zone_line', 470, -40, { style: { width: 1620, height: 520 }, zIndex: -1 }, { label: DEPT });
  zone.data = { ...zone.data, zone: { ...zone.data.zone!, department_id: DEPT } };
  const child = (id: string, role: string, x: number, y: number) => mk(id, role, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const childCustom = (id: string, x: number, y: number) => mkCustom(id, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const untrusted = mk('zone_web', 'zone_untrusted', 2430, -30, { style: { width: 260, height: 200 }, zIndex: -1 });
  const nodes: SNode[] = [
    mk('founder', 'founder', 0, 260),
    mk('orch', 'orchestrator', 230, 260, {}, { prefix: 'core' }),
    zone,
    child('mgr', 'manager', 30, 210),
    // Stage 1 — scouting & collection
    child('scout', 'scout', 320, 0),
    childCustom('collector', 320, 135),
    child('transformer', ROLE_OF.transformer, 320, 270),
    // Stage 2 — data & context
    child('ctx', 'context', 640, 0),
    child('custodian', ROLE_OF.custodian, 640, 135),
    child('eva', 'evaluator', 640, 270),
    // Stage 3 — content & persona
    child('str', 'strategist', 960, 0),
    childCustom('content_selector', 960, 135),
    childCustom('creator', 960, 270),
    child('drf', 'drafter', 960, 405),
    // Stage 4 — operations & income
    child('publisher', ROLE_OF.publisher, 1280, 0),
    child('compliance', ROLE_OF.compliance, 1280, 135),
    child('income_mgr', ROLE_OF.income_mgr, 1280, 270),
    child('perf_analyst', ROLE_OF.perf_analyst, 1280, 405),
    // Infrastructure (right column)
    mk('ssrf', 'ssrf_guard', 2170, 40),
    mk('l1', 'l1', 2170, 160),
    mk('l2', 'l2', 2170, 280),
    mk('l3', 'l3', 2170, 400),
    mk('creator_profile', 'l2', 2170, 520),
    mk('income_register', 'l2', 2170, 640),
    mk('pe', 'policy_engine', 2170, 760),
    mk('bg', 'budget_guard', 2170, 880),
    untrusted,
    { ...mk('web', 'external', 40, 70), parentId: 'zone_web', extent: 'parent' },
    mk('kill', 'kill_switch', 470, 700),
  ];
  for (const n of nodes) {
    n.data.label = LABELS[n.id] ?? n.data.label;
    n.data.status = STATUS[n.id] ?? n.data.status;
  }
  const e = (s: string, t: string, k: CableKind, a?: 'read' | 'write') => mkEdge(s, t, k, a);
  const EMPLOYEES = ['scout', 'collector', 'transformer', 'ctx', 'custodian', 'eva', 'str', 'content_selector', 'creator', 'drf', 'publisher', 'compliance', 'income_mgr', 'perf_analyst'];
  const edges: SEdge[] = [
    e('founder', 'orch', 'OBJECTIVE_ROUTE'),
    e('orch', 'mgr', 'OBJECTIVE_ROUTE'),
    ...EMPLOYEES.map((id) => e('mgr', id, 'TASK_DISPATCH_RESULT')),
    e('mgr', 'founder', 'ESCALATION_PATH'),
    e('scout', 'ssrf', 'EGRESS_NETWORK'),
    e('ssrf', 'web', 'EGRESS_NETWORK'),
    e('publisher', 'ssrf', 'EGRESS_NETWORK'),
    // Raw layer in, structured data out
    e('scout', 'l1', 'MEMORY_BUS', 'write'),
    e('collector', 'l1', 'MEMORY_BUS', 'write'),
    e('transformer', 'l1', 'MEMORY_BUS', 'read'),
    e('transformer', 'l2', 'MEMORY_BUS', 'write'),
    e('transformer', 'income_register', 'MEMORY_BUS', 'write'),
    e('custodian', 'l2', 'MEMORY_BUS', 'read'),
    e('custodian', 'l3', 'MEMORY_BUS', 'write'),
    // Creator profile: strategist writes, drafter/evaluator/compliance/analyst read
    e('str', 'creator_profile', 'MEMORY_BUS', 'write'),
    e('drf', 'creator_profile', 'MEMORY_BUS', 'read'),
    e('eva', 'creator_profile', 'MEMORY_BUS', 'read'),
    e('compliance', 'creator_profile', 'MEMORY_BUS', 'read'),
    e('perf_analyst', 'creator_profile', 'MEMORY_BUS', 'read'),
    // Evaluation reads the database
    e('eva', 'l2', 'MEMORY_BUS', 'read'),
    e('compliance', 'l2', 'MEMORY_BUS', 'read'),
    // Income register: money roles read it
    e('income_mgr', 'income_register', 'MEMORY_BUS', 'read'),
    e('income_mgr', 'l2', 'MEMORY_BUS', 'read'),
    e('perf_analyst', 'income_register', 'MEMORY_BUS', 'read'),
    e('perf_analyst', 'l2', 'MEMORY_BUS', 'read'),
    // Context and strategy reads (v1, kept)
    e('ctx', 'l3', 'MEMORY_BUS', 'read'),
    e('str', 'l2', 'MEMORY_BUS', 'read'),
    // Kill plane: manager (halts the department) + the two irreversible-action nodes
    e('kill', 'mgr', 'KILL_PLANE_SIGNAL'),
    e('kill', 'publisher', 'KILL_PLANE_SIGNAL'),
    e('kill', 'creator', 'KILL_PLANE_SIGNAL'),
  ];
  return { nodes, edges };
}

export function buildInfluencerV2Project(now = new Date().toISOString()): ProjectFile {
  // Deterministic build: the factory stamps each manifest with the
  // created_at passed in the factory options, so the file hash identifies
  // the topology, not the build minute.
  const { nodes, edges } = buildInfluencerV2Topology(TENANT_ID, now);
  return {
    format_version: CURRENT_FORMAT_VERSION,
    app: 'socroot-topology-studio',
    id: 'proj-influencers-system-v2',
    name: 'منظومة المؤثرين (v2)',
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

describe('influencer system topology v2 (full pipeline, 7 Nov 2026)', () => {
  const project = buildInfluencerV2Project('2026-11-07T05:45:00.000Z');
  const { nodes, edges } = project;
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  it('has 29 nodes and 43 edges with stable ids', () => {
    expect(nodes).toHaveLength(29);
    expect(edges).toHaveLength(43);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(29);
    expect(edges.every((x) => byId(x.source) && byId(x.target))).toBe(true);
  });

  it('covers the founder’s seven pipeline stages', () => {
    const stage: Record<string, string[]> = {
      scouting: ['scout', 'collector'],
      database: ['l1', 'transformer', 'l2', 'custodian', 'l3'],
      content_choice: ['content_selector'],
      creator_spec: ['creator', 'creator_profile'],
      income_sources: ['income_mgr', 'income_register'],
      operations: ['publisher', 'compliance'],
      income_outcome: ['perf_analyst'],
    };
    for (const [name, ids] of Object.entries(stage)) {
      for (const id of ids) expect(byId(id), `${name}: ${id}`).toBeTruthy();
    }
  });

  it('uses honest statuses: 7 implemented, the rest planned', () => {
    const implemented = nodes.filter((n) => n.data.status === 'IMPLEMENTED').map((n) => n.id).sort();
    expect(implemented).toEqual(['bg', 'founder', 'kill', 'l2', 'pe', 'ssrf', 'zone_web']);
    expect(nodes.filter((n) => n.data.status === 'PLANNED')).toHaveLength(22);
  });

  it('custom roles carry embedded contracts and are not registry roles', () => {
    for (const id of ['collector', 'content_selector', 'creator']) {
      expect(getRole(id), id).toBeUndefined();
      const n = byId(id);
      expect(n.data.employee, id).toBeTruthy();
      const contract = n.data.employee!.contract as { employee_id: string; role: string };
      expect(contract.employee_id).toBe(`inf.${id}.v1`);
      expect(contract.role).toBe(id);
      // The creator contract must not invent the founder's open decisions.
      if (id === 'creator') {
        const c = n.data.employee!.contract as { mission: string; exclusions: string[] };
        expect(c.exclusions.join(' ')).toMatch(/founder decisions, still open/);
      }
    }
  });

  it('registry drop-in file matches the embedded custom roles', () => {
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
    // 14 employees + the manager, all inside the PLANNED department (v1: 5 + 1 = 6).
    expect(warnings).toHaveLength(15);
    expect(new Set(warnings.map((w) => w.code))).toEqual(new Set(['ORG-003']));
  });

  it('writes the deliverable file and re-reads it clean', () => {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    const text = serializeProject(project);
    fs.writeFileSync(OUT_PATH, `${text}\n`);
    const back = parseProjectText(fs.readFileSync(OUT_PATH, 'utf-8'));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.project.nodes).toHaveLength(29);
      expect(back.project.edges).toHaveLength(43);
      expect(back.project.horizon).toBe('TRANSITIONAL');
      expect(back.project.id).toBe('proj-influencers-system-v2');
    }
    // The regenerated file must be byte-identical to the delivered one.
    const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT_PATH)).digest('hex');
    expect(sha).toBe(EXPECTED_SHA256);
  });
});
