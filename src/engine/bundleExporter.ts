import { employeeFiles, type GeneratedFile } from './generators';
import { collectProblems, errorCount, isEmployeeNode, type Problem } from './problems';
import type { ProjectConfigs, SEdge, SNode } from '../types';

/**
 * Pure export planner: decides WHICH files the ZIP contains. Zipping itself is `zipBundle.ts`.
 * Layout: departments/<department>/<employee_id>/{contract.json,manifest.yaml,employee.py,tools.py,policies.py,skills/*.md} + config/*.yaml.
 * ORG-003 (§1.4.3): no folder is created for a department that is not IMPLEMENTED.
 */
export interface SkippedItem { employee_id: string; department: string; code: 'ORG-003' | 'STATUS'; reason: string }
export interface Bundle { files: GeneratedFile[]; skipped: SkippedItem[]; employees: number; departments: string[] }
export type BundleResult = { ok: true; bundle: Bundle } | { ok: false; errors: Problem[] };

const NOT_EXPORTED = new Set(['PLANNED', 'TRIGGER_BASED', 'DEPRECATED']);
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_') || '_';

export function planBundle(nodes: SNode[], configs: ProjectConfigs): Bundle {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const files: GeneratedFile[] = [], skipped: SkippedItem[] = [], depts = new Set<string>();
  let employees = 0;
  for (const n of nodes) {
    if (!isEmployeeNode(n)) continue;
    const c = n.data.employee, ct = c.contract as { employee_id?: string; department?: string };
    const id = ct.employee_id ?? n.id;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    const department = parent?.data.zone?.department_id ?? ct.department ?? 'unassigned';
    if (parent?.data.kind === 'zone' && parent.data.status !== 'IMPLEMENTED') {
      skipped.push({ employee_id: id, department, code: 'ORG-003', reason: `Department ${department} is ${parent.data.status}; no folder is created (ORG-003).` }); continue;
    }
    if (NOT_EXPORTED.has(n.data.status)) { skipped.push({ employee_id: id, department, code: 'STATUS', reason: `Role status is ${n.data.status}; it is not exported.` }); continue; }
    depts.add(department); employees++;
    for (const f of employeeFiles(c)) files.push({ path: `departments/${safe(department)}/${safe(id)}/${f.path}`, content: f.content });
  }
  files.push({ path: 'config/model_routing.yaml', content: configs.model_routing }, { path: 'config/sources_watchlist.yaml', content: configs.sources_watchlist }, { path: 'config/pricing_config.yaml', content: configs.pricing_config });
  return { files, skipped, employees, departments: [...depts].sort() };
}

/** Export gate: any error in the Problems list blocks the export (the UI shows the count and the first reason). */
export function buildBundle(nodes: SNode[], edges: SEdge[], configs: ProjectConfigs, tenant_id: string): BundleResult {
  const problems = collectProblems(nodes, edges, { tenant_id });
  if (errorCount(problems) > 0) return { ok: false, errors: problems.filter((p) => p.severity === 'error') };
  return { ok: true, bundle: planBundle(nodes, configs) };
}
