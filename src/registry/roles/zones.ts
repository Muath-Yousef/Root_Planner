import type { RoleDefinition } from '../definitions';
const defs: RoleDefinition[] = [
  { id: 'zone_line', kind: 'zone', category: 'Zones', ref: '§1.4.1', label: { en: 'Line department', ar: 'قسم تنفيذي' },
    description: { en: 'FUNCTIONAL_LINE: market-facing work such as opportunity acquisition.', ar: 'FUNCTIONAL_LINE: أعمال موجهة للسوق مثل اقتناص الفرص.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'], zone: { zone: 'line', isolation: 'internal', department_class: 'FUNCTIONAL_LINE' } },
  { id: 'zone_meta', kind: 'zone', category: 'Zones', ref: '§1.4.1 / FAC-001', label: { en: 'Meta department', ar: 'قسم تشغيلي (Meta)' },
    description: { en: 'OPERATIONAL_META: Employee Factory, security, tooling intelligence. PARTIAL — not exported (ORG-003).', ar: 'OPERATIONAL_META: مصنع الموظفين والأمن واستخبارات الأدوات. PARTIAL — لا يُصدَّر (ORG-003).' },
    architecture_horizon: 'TRANSITIONAL', implementation_status: 'PARTIAL', inspector: ['identity'], zone: { zone: 'meta', isolation: 'internal', department_class: 'OPERATIONAL_META' } },
  { id: 'zone_docker', kind: 'zone', category: 'Zones', ref: '§5.4.1', label: { en: 'Docker boundary', ar: 'حدّ Docker' },
    description: { en: 'Draws the container network boundary: internal, isolated or none.', ar: 'يرسم حدّ شبكة الحاويات: internal أو isolated أو none.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'], zone: { zone: 'docker', isolation: 'internal' } },
  { id: 'zone_dedicated', kind: 'zone', category: 'Zones', ref: '§5.7.4 / TEN-004', label: { en: 'Dedicated client environment', ar: 'بيئة عميل مخصصة' },
    description: { en: 'TEN-004 physical isolation. TARGET, trigger-based: needs a contract that requires separation.', ar: 'TEN-004 عزل فيزيائي. TARGET ومشروط بمحفز: يلزم عقد يشترط الفصل.' },
    architecture_horizon: 'TARGET', implementation_status: 'TRIGGER_BASED', inspector: ['identity'], zone: { zone: 'docker', isolation: 'isolated' } },
  { id: 'zone_untrusted', kind: 'zone', category: 'Zones', ref: '§1.4 / Diagram 1', label: { en: 'Untrusted world', ar: 'العالم غير الموثوق' },
    description: { en: 'Everything outside the organization. Nothing here is trusted.', ar: 'كل ما هو خارج المنظمة. لا شيء هنا موثوق.' },
    architecture_horizon: 'CURRENT', implementation_status: 'IMPLEMENTED', inspector: ['identity'], zone: { zone: 'untrusted', isolation: 'none' } },
];
export default defs;
