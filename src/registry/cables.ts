import type { CableKind, SEdge } from '../types';
import type { CableDefinition } from './definitions';

/** Cabling rules are data. cablingValidator reads `links`; nothing else decides what may be wired. */
export const CABLE_DEFS: Record<CableKind, CableDefinition> = {
  OBJECTIVE_ROUTE: { kind: 'OBJECTIVE_ROUTE', color: '#f2b23a', dashed: false, dashArray: undefined, patternName: 'Solid',
    label: { en: 'Objective route', ar: 'مسار الهدف' }, description: { en: 'Founder → orchestrator → manager. Carries objective_route messages.', ar: 'المؤسس ← المنسّق ← المدير. يحمل رسائل objective_route.' },
    links: [{ from: { kinds: ['founder'] }, to: { kinds: ['orchestrator'] } }, { from: { kinds: ['orchestrator'] }, to: { kinds: ['manager'] } }] },
  TASK_DISPATCH_RESULT: { kind: 'TASK_DISPATCH_RESULT', color: '#2cc4dd', dashed: true, dashArray: '8 4', patternName: 'Dash (8 4)',
    label: { en: 'Task dispatch / result', ar: 'إسناد المهمة / النتيجة' }, description: { en: 'Manager ⇄ employee, manager → subordinate manager. task_dispatch out, task_result back.', ar: 'المدير ⇄ الموظف، والمدير ← مدير فريق أدنى. task_dispatch ذهاباً وtask_result إياباً.' },
    links: [{ from: { kinds: ['manager'] }, to: { kinds: ['employee'] } }, { from: { kinds: ['employee'] }, to: { kinds: ['manager'] } }, { from: { kinds: ['manager'] }, to: { kinds: ['manager'] } }] },
  ESCALATION_PATH: { kind: 'ESCALATION_PATH', color: '#f2803a', dashed: true, dashArray: '12 4 2 4', patternName: 'Dash-Dot',
    label: { en: 'Escalation path', ar: 'مسار التصعيد' }, description: { en: 'Employee → manager → senior manager → founder, as an escalation_package. No employee talks to the founder directly.', ar: 'الموظف ← المدير ← مدير أعلى ← المؤسس عبر escalation_package. لا يتواصل موظف مع المؤسس مباشرة.' },
    links: [{ from: { kinds: ['employee'] }, to: { kinds: ['manager'] } }, { from: { kinds: ['manager'] }, to: { kinds: ['manager'] } }, { from: { kinds: ['manager'] }, to: { kinds: ['founder'] } }] },
  MEMORY_BUS: { kind: 'MEMORY_BUS', color: '#a66cf0', dashed: true, dashArray: '3 3', patternName: 'Dot (3 3)',
    label: { en: 'Memory bus', ar: 'ناقل الذاكرة' }, description: { en: 'Employee or manager → memory tier (L1–L4), checked against ROLE_PERMISSIONS.', ar: 'الموظف أو المدير ← طبقة ذاكرة (L1–L4)، ويُفحص مقابل ROLE_PERMISSIONS.' },
    links: [{ from: { kinds: ['employee', 'manager'] }, to: { kinds: ['memory'] } }] },
  EGRESS_NETWORK: { kind: 'EGRESS_NETWORK', color: '#34c48b', dashed: true, dashArray: '10 3 2 3 2 3', patternName: 'Dash-Double-Dot',
    label: { en: 'Egress network', ar: 'شبكة الخروج' }, description: { en: 'Employee → SSRFGuard → approved source. The only way out.', ar: 'الموظف ← SSRFGuard ← مصدر معتمد. المخرج الوحيد.' },
    links: [{ from: { kinds: ['employee'] }, to: { roles: ['ssrf_guard'] } }, { from: { roles: ['ssrf_guard'] }, to: { kinds: ['external'] } }] },
  KILL_PLANE_SIGNAL: { kind: 'KILL_PLANE_SIGNAL', color: '#ef4b4b', dashed: true, dashArray: '1 4', patternName: 'Fine Dot (1 4)',
    label: { en: 'Kill-plane signal', ar: 'إشارة الإيقاف' }, description: { en: 'Kill switch → anything it must be able to halt. Independent of the app plane.', ar: 'قاطع الطوارئ ← كل ما يجب أن يوقفه. مستقل عن مستوى التطبيق.' },
    links: [{ from: { roles: ['kill_switch'] }, to: { kinds: ['orchestrator', 'manager', 'employee'] } }] },
};
export const CABLE_KINDS = Object.keys(CABLE_DEFS) as CableKind[];
export const edgeId = (s: string, t: string, k: CableKind) => `${s}>${t}:${k}`;
export const mkEdge = (source: string, target: string, kind: CableKind, access?: 'read' | 'write'): SEdge => ({
  id: edgeId(source, target, kind), source, target, type: 'protocol', sourceHandle: `out:${kind}`, targetHandle: `in:${kind}`, animated: true,
  data: { kind, ...(kind === 'MEMORY_BUS' ? { access: access ?? 'read' } : {}) },
});
