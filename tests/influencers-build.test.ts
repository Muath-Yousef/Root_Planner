import { describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { templateNodeData } from '../src/engine/employeeFactory';
import { checkCable } from '../src/engine/cablingValidator';
import { collectProblems, errorCount } from '../src/engine/problems';
import { parseProjectText, serializeProject } from '../src/persistence/projectIO';
import { MODEL_ROUTING_YAML, PRICING_CONFIG_YAML } from '../src/presets/referenceConfigs';
import { CURRENT_FORMAT_VERSION } from '../src/schemas/project';
import { mkEdge } from '../src/registry';
import type { CableKind, ProjectFile, SEdge, SNode } from '../src/types';

/**
 * Influencer system topology v1 for Root Planner (socroot-topology-studio, format v2).
 * Recovered into the repo in Phase 0 (plan: root-planner-improvement-plan.md).
 * It was first built on 7 Nov 2026 as a vitest generator outside the repo; the
 * delivered file is examples/influencers_system.socroot.json and its governing
 * hash is EXPECTED_SHA256 below. v1 is the founder-approved skeleton the
 * later versions extend: founder → orchestrator → influencer-sector manager →
 * scout / context (the 170-row base) / evaluator / strategist / drafter, with
 * policy/budget/kill guards and egress to Instagram, in the studio's own
 * cables. No custom roles yet — every employee is a registry role, and every
 * contract is the studio factory's own output.
 */

const DEPT = 'dept_influencer_system';
const TENANT_ID = 'socroot-core';
const OUT_PATH = path.join(process.cwd(), 'examples', 'influencers_system.socroot.json');
/** Governing hash of the delivered v1 file (7 Nov 2026, deterministic build). */
const EXPECTED_SHA256 = '6386032a8db0de96ade7636af451c275d4250b119896bbac0aa46905a84e0272';

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

type Status = SNode['data']['status'];

const STATUS: Record<string, Status> = {
  founder: 'IMPLEMENTED',
  orch: 'PLANNED',
  zone_dept: 'PLANNED',
  mgr: 'PLANNED',
  scout: 'PLANNED',
  ctx: 'PLANNED',
  eva: 'PLANNED',
  str: 'PLANNED',
  drf: 'PLANNED',
  ssrf: 'IMPLEMENTED',
  zone_web: 'IMPLEMENTED',
  web: 'PLANNED',
  l3: 'PLANNED',
  l2: 'IMPLEMENTED',
  pe: 'IMPLEMENTED',
  bg: 'IMPLEMENTED',
  kill: 'IMPLEMENTED',
};

const LABELS: Record<string, string> = {
  founder: 'المؤسس',
  orch: 'المنسق',
  zone_dept: DEPT,
  mgr: 'مدير قطاع المؤثرين',
  scout: 'المستطلع',
  ctx: 'السياق',
  eva: 'المقيّم',
  str: 'الاستراتيجي',
  drf: 'الصائغ',
  ssrf: 'حارس SSRF ووكيل الخروج',
  zone_web: 'العالم غير الموثوق',
  web: 'Instagram',
  l3: 'L3 — الذاكرة الدلالية',
  l2: 'L2 — قاعدة بيانات المؤثرين',
  pe: 'محرك السياسات',
  bg: 'حارس الميزانية',
  kill: 'قاطع الطوارئ',
};

export function buildInfluencerTopology(tenant_id = TENANT_ID, now = new Date().toISOString()): { nodes: SNode[]; edges: SEdge[] } {
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
  const zone = mk('zone_dept', 'zone_line', 470, -40, { style: { width: 560, height: 640 }, zIndex: -1 }, { label: DEPT });
  zone.data = { ...zone.data, zone: { ...zone.data.zone!, department_id: DEPT } };
  const child = (id: string, role: string, x: number, y: number) => mk(id, role, x, y, { parentId: 'zone_dept', extent: 'parent' });
  const untrusted = mk('zone_web', 'zone_untrusted', 1380, -30, { style: { width: 260, height: 200 }, zIndex: -1 });
  const nodes: SNode[] = [
    mk('founder', 'founder', 0, 260),
    // The orchestrator is a core employee: its department is 'core' and its
    // manager is the core manager — not the sector manager (v2 changed this).
    mk('orch', 'orchestrator', 230, 260, {}, { prefix: 'core', department: 'core', manager_id: 'core.manager.v1' }),
    zone,
    child('mgr', 'manager', 30, 270),
    child('scout', 'scout', 320, 40),
    child('ctx', 'context', 320, 170),
    child('eva', 'evaluator', 320, 300),
    child('str', 'strategist', 320, 430),
    child('drf', 'drafter', 320, 540),
    // Infrastructure (right column)
    mk('ssrf', 'ssrf_guard', 1130, 40),
    untrusted,
    { ...mk('web', 'external', 40, 70), parentId: 'zone_web', extent: 'parent' },
    mk('l3', 'l3', 1130, 190),
    mk('l2', 'l2', 1130, 330),
    mk('pe', 'policy_engine', 1130, 470),
    mk('bg', 'budget_guard', 1130, 560),
    mk('kill', 'kill_switch', 470, 700),
  ];
  for (const n of nodes) {
    n.data.label = LABELS[n.id] ?? n.data.label;
    n.data.status = STATUS[n.id] ?? n.data.status;
  }
  const e = (s: string, t: string, k: CableKind, a?: 'read' | 'write') => mkEdge(s, t, k, a);
  const EMPLOYEES = ['scout', 'ctx', 'eva', 'str', 'drf'];
  const edges: SEdge[] = [
    e('founder', 'orch', 'OBJECTIVE_ROUTE'),
    e('orch', 'mgr', 'OBJECTIVE_ROUTE'),
    ...EMPLOYEES.map((id) => e('mgr', id, 'TASK_DISPATCH_RESULT')),
    e('mgr', 'founder', 'ESCALATION_PATH'),
    e('scout', 'ssrf', 'EGRESS_NETWORK'),
    e('ssrf', 'web', 'EGRESS_NETWORK'),
    e('ctx', 'l3', 'MEMORY_BUS', 'read'),
    e('str', 'l2', 'MEMORY_BUS', 'read'),
    e('kill', 'mgr', 'KILL_PLANE_SIGNAL'),
  ];
  return { nodes, edges };
}

export function buildInfluencerProject(now = new Date().toISOString()): ProjectFile {
  // Deterministic build: the factory stamps each manifest with the
  // created_at passed in the factory options, so the file hash identifies
  // the topology, not the build minute.
  const { nodes, edges } = buildInfluencerTopology(TENANT_ID, now);
  return {
    format_version: CURRENT_FORMAT_VERSION,
    app: 'socroot-topology-studio',
    id: 'proj-influencers-system-v1',
    name: 'منظومة المؤثرين',
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

describe('influencer system topology v1 (founder-approved skeleton, 7 Nov 2026)', () => {
  const project = buildInfluencerProject('2026-11-07T05:00:00.000Z');
  const { nodes, edges } = project;
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  it('has 17 nodes and 13 edges with stable ids', () => {
    expect(nodes).toHaveLength(17);
    expect(edges).toHaveLength(13);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(17);
    expect(edges.every((x) => byId(x.source) && byId(x.target))).toBe(true);
  });

  it('covers the approved skeleton: command chain, five employees, guards, egress', () => {
    for (const id of ['founder', 'orch', 'mgr', 'scout', 'ctx', 'eva', 'str', 'drf']) {
      expect(byId(id), id).toBeTruthy();
    }
    for (const id of ['ssrf', 'l2', 'l3', 'pe', 'bg', 'kill', 'zone_web', 'web']) {
      expect(byId(id), id).toBeTruthy();
    }
    // Every employee is a registry role; no custom role exists in v1.
    for (const id of ['scout', 'ctx', 'eva', 'str', 'drf']) {
      expect(byId(id).data.role).toBe(id === 'ctx' ? 'context' : id === 'eva' ? 'evaluator' : id === 'str' ? 'strategist' : id === 'drf' ? 'drafter' : 'scout');
    }
  });

  it('uses honest statuses: 7 implemented, the rest planned', () => {
    const implemented = nodes.filter((n) => n.data.status === 'IMPLEMENTED').map((n) => n.id).sort();
    expect(implemented).toEqual(['bg', 'founder', 'kill', 'l2', 'pe', 'ssrf', 'zone_web']);
    expect(nodes.filter((n) => n.data.status === 'PLANNED')).toHaveLength(10);
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
    // 5 employees + the manager, all inside the PLANNED department.
    expect(warnings).toHaveLength(6);
    expect(new Set(warnings.map((w) => w.code))).toEqual(new Set(['ORG-003']));
  });

  it('writes the deliverable file and re-reads it clean', () => {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    const text = serializeProject(project);
    fs.writeFileSync(OUT_PATH, `${text}\n`);
    const back = parseProjectText(fs.readFileSync(OUT_PATH, 'utf-8'));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.project.nodes).toHaveLength(17);
      expect(back.project.edges).toHaveLength(13);
      expect(back.project.horizon).toBe('TRANSITIONAL');
      expect(back.project.id).toBe('proj-influencers-system-v1');
    }
    // The regenerated file must be byte-identical to the delivered one.
    const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT_PATH)).digest('hex');
    expect(sha).toBe(EXPECTED_SHA256);
  });
});
