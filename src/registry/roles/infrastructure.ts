import type { RoleDefinition } from '../definitions';

const mem = (tier: 'L1' | 'L2' | 'L3' | 'L4', en: string, ar: string, dEn: string, dAr: string): RoleDefinition => ({
  id: tier.toLowerCase(), kind: 'memory', category: 'Memory', ref: '§5.3.1', memory_tier: tier, label: { en, ar }, description: { en: dEn, ar: dAr },
  architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'],
});
const guard = (id: string, ref: string, en: string, ar: string, dEn: string, dAr: string, extra: Partial<RoleDefinition> = {}): RoleDefinition => ({
  id, kind: 'guard', category: 'Guards', ref, label: { en, ar }, description: { en: dEn, ar: dAr },
  architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'], ...extra,
});
const defs: RoleDefinition[] = [
  mem('L1', 'L1 WorkingMemory', 'L1 ذاكرة العمل', 'Task-scoped memory, wiped on completion.', 'ذاكرة محصورة بالمهمة وتُمحى عند إنجازها.'),
  mem('L2', 'L2 PostgresStateDriver', 'L2 حالة PostgreSQL', 'Durable state with optimistic locking.', 'حالة دائمة مع قفل متفائل.'),
  mem('L3', 'L3 VectorDriver', 'L3 ذاكرة المتجهات', 'Semantic memory in tenant-scoped namespaces.', 'ذاكرة دلالية في نطاقات خاصة بكل مستأجر.'),
  mem('L4', 'L4 AuditLogger', 'L4 سجل التدقيق', 'Append-only SHA-256 hash chain. Nobody modifies it.', 'سلسلة هاشات SHA-256 للإلحاق فقط. لا أحد يعدّله.'),
  guard('policy_engine', '§4.3', 'PolicyEngine', 'محرك السياسات', 'Five tiers ending in POL_DEFAULT_DENY.', 'خمس طبقات تنتهي بـ POL_DEFAULT_DENY.'),
  guard('budget_guard', '§6.1 / §6.7', 'BudgetGuard', 'حارس الميزانية', 'Task and department caps; Reserve → Commit → Release.', 'سقف للمهمة والقسم؛ حجز ثم التزام ثم تحرير.'),
  guard('ssrf_guard', '§5.4.2', 'SSRFGuard & Egress Proxy', 'حارس SSRF ووكيل الخروج', 'The only door to the outside world.', 'الباب الوحيد إلى العالم الخارجي.'),
  guard('kill_switch', '§4.4 / §4.6.1', 'KillSwitchManager', 'قاطع الطوارئ', 'Independent kill plane: task, employee, department, global.', 'مستوى إيقاف مستقل: مهمة وموظف وقسم وشامل.'),
  { id: 'external', kind: 'external', category: 'External', ref: '§5.4.3', label: { en: 'Approved Sources', ar: 'المصادر المعتمدة' },
    description: { en: 'The approved_sources allowlist of sources_watchlist.yaml.', ar: 'قائمة approved_sources في sources_watchlist.yaml.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'] },
];
export default defs;
