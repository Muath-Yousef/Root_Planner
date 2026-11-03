import type { Horizon, IsolationMode } from '../types';
/** TEN-002/003/004 (§5.7). Dedicated deployment is a TARGET, trigger-based capability, so it is only offered at the TARGET horizon. */
export interface TenantProfile { tenant_id: string; name: string; isolation: IsolationMode; horizon: Horizon; summary: { en: string; ar: string }; controls: string[] }
export const TENANT_PROFILES: TenantProfile[] = [
  { tenant_id: 'socroot-core', name: 'Sovereign Core', isolation: 'logical_rls', horizon: 'CURRENT',
    summary: { en: 'The organization’s own internal departments, inside the sovereign scope.', ar: 'الأقسام الداخلية للمنظمة نفسها ضمن النطاق السيادي.' }, controls: ['tenant_id on every message', 'Internal Docker network'] },
  { tenant_id: 'client_rls_001', name: 'RLS Client', isolation: 'logical_rls', horizon: 'CURRENT',
    summary: { en: 'Standard tier: shared tables with tenant_id, PostgreSQL row-level security and vector namespaces.', ar: 'المستوى القياسي: جداول مشتركة مع tenant_id وأمان مستوى الصف في PostgreSQL ونطاقات متجهية.' }, controls: ['PostgreSQL RLS', 'Vector namespace per tenant', 'Memory wipe after each task'] },
  { tenant_id: 'client_ten004', name: 'Dedicated Client (TEN-004)', isolation: 'dedicated', horizon: 'TARGET',
    summary: { en: 'Dedicated high-security tier: own containers, Docker network, database and encryption keys. Activated by a contract that requires physical separation.', ar: 'المستوى المخصص عالي الأمان: حاويات وشبكة Docker وقاعدة بيانات ومفاتيح تشفير مستقلة. يُفعَّل بعقد يشترط الفصل الفيزيائي.' }, controls: ['Separate cloud account/VPC', 'Dedicated KMS keys', 'Dedicated database'] },
];
export const tenantProfile = (id: string) => TENANT_PROFILES.find((t) => t.tenant_id === id);
export const TENANT_ID_RE = /^[a-z][a-z0-9_-]{2,40}$/;
