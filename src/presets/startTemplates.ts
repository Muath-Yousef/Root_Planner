import { templateNodeData } from '../engine/employeeFactory';
import { defaultConfigs } from './defaultConfigs';
import { buildReferenceTopology } from './referenceTopology';
import { TENANT_ID_RE, tenantProfile } from './tenantProfiles';
import type { Horizon, IsolationMode, ProjectFile, SEdge, SNode } from '../types';
import { CURRENT_FORMAT_VERSION } from '../schemas/project';

export interface L10n { en: string; ar: string }
export type TemplateId = 'reference' | 'rls' | 'ten004' | 'blank';
export interface StartTemplate { id: TemplateId; label: L10n; description: L10n; tenant_id: string; horizon: Horizon }

/** Start-screen cards. Adding a template = one entry here and one case in `topologyFor`. */
export const START_TEMPLATES: StartTemplate[] = [
  { id: 'reference', tenant_id: 'socroot-core', horizon: 'CURRENT', label: { en: 'Reference department', ar: 'القسم المرجعي' },
    description: { en: 'dept_opportunity_acquisition with its manager and five employees, wired and valid.', ar: 'قسم dept_opportunity_acquisition بمديره وموظفيه الخمسة، موصولاً وسليماً.' } },
  { id: 'rls', tenant_id: 'client_rls_001', horizon: 'CURRENT', label: { en: 'RLS client company', ar: 'شركة عميل RLS' },
    description: { en: 'Standard tier: shared tables with tenant_id and row-level security.', ar: 'المستوى القياسي: جداول مشتركة مع tenant_id وأمان مستوى الصف.' } },
  { id: 'ten004', tenant_id: 'client_ten004', horizon: 'TARGET', label: { en: 'Dedicated client (TEN-004)', ar: 'عميل مخصص (TEN-004)' },
    description: { en: 'High-security tier with its own containers, network and keys. Shown at the TARGET horizon.', ar: 'مستوى عالي الأمان بحاويات وشبكة ومفاتيح مستقلة. يظهر في أفق TARGET.' } },
  { id: 'blank', tenant_id: 'socroot-core', horizon: 'CURRENT', label: { en: 'Blank canvas', ar: 'لوحة فارغة' },
    description: { en: 'Start from nothing and drag components from the dock.', ar: 'ابدأ من الصفر واسحب المكوّنات من الشريط السفلي.' } },
];

export function topologyFor(template: TemplateId, tenant_id: string): { nodes: SNode[]; edges: SEdge[] } {
  if (template === 'blank') return { nodes: [], edges: [] };
  const t = buildReferenceTopology(tenant_id);
  if (template !== 'ten004') return t;
  const data = templateNodeData('zone_dedicated', { label: 'Dedicated client environment' });
  const boundary: SNode = { id: 'zone_dedicated', type: 'zone', position: { x: -60, y: -140 }, data, style: { width: 1760, height: 940 }, zIndex: -2 };
  return { nodes: [boundary, ...t.nodes], edges: t.edges };
}

export interface WizardInput { name: string; tenant_id: string; template: TemplateId; isolation?: IsolationMode; id?: string; now?: string }
export type WizardResult = { ok: true; project: ProjectFile } | { ok: false; field: 'name' | 'tenant_id'; code: string; message: L10n };

/** Step 3 of the "new company" wizard. Validates, then builds a complete project file. Pure. */
export function createProject(i: WizardInput): WizardResult {
  const name = i.name.trim(), tenant_id = i.tenant_id.trim();
  if (!name) return { ok: false, field: 'name', code: 'WIZ_NAME_REQUIRED', message: { en: 'Give the company a name.', ar: 'أعطِ الشركة اسماً.' } };
  if (!TENANT_ID_RE.test(tenant_id)) return { ok: false, field: 'tenant_id', code: 'WIZ_TENANT_ID', message: { en: 'Tenant id: 3–41 characters, starts with a letter, then lowercase letters, digits, "_" or "-".', ar: 'معرّف المستأجر: من 3 إلى 41 حرفاً، يبدأ بحرف ثم أحرف صغيرة أو أرقام أو "_" أو "-".' } };
  const profile = tenantProfile(tenant_id);
  const isolation: IsolationMode = profile?.isolation ?? i.isolation ?? 'logical_rls';
  const tpl = START_TEMPLATES.find((t) => t.id === i.template);
  const horizon: Horizon = isolation === 'dedicated' ? 'TARGET' : (tpl?.horizon ?? 'CURRENT');
  const now = i.now ?? new Date().toISOString();
  const { nodes, edges } = topologyFor(i.template, tenant_id);
  return { ok: true, project: {
    format_version: CURRENT_FORMAT_VERSION, app: 'socroot-topology-studio', id: i.id ?? `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name, tenant: { tenant_id, isolation, name: profile?.name ?? tenant_id }, horizon, created_at: now, updated_at: now, nodes, edges, configs: defaultConfigs(),
  } };
}
