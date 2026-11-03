export interface MessageEntry {
  en: string;
  ar: string;
}

export const cablingMessages: Record<string, MessageEntry> = {
  POL_DRF_HARD_01: {
    en: 'Hard rule POL_DRF_HARD_01: Drafter, Evaluator, and roles with zero egress must never connect to external or egress networks.',
    ar: 'قاعدة حتمية POL_DRF_HARD_01: يُمنع ربط الصائغ أو المقيّم أو أي دور محظور الخروج بشبكات خارجية.'
  },
  CAB_PORT_MISMATCH: {
    en: 'Port mismatch: The target port does not accept this cable kind.',
    ar: 'عدم تطابق في المنفذ: المنفذ المستهدف لا يقبل هذا النوع من الكوابل.'
  },
  CAB_DIRECTION_INVALID: {
    en: 'Invalid direction: Cables must connect from an OUT (source) port to an IN (target) port.',
    ar: 'اتجاه غير صالح: يجب توصيل الكابل من منفذ إخراج (مصدر) إلى منفذ إدخال (هدف).'
  },
  CAB_SELF_CONNECTION: {
    en: 'Self-connection rejected: A node cannot connect a cable to itself.',
    ar: 'تم رفض الاتصال الذاتي: لا يمكن للعقدة توصيل كابل بنفسها.'
  },
  CAB_KIND_INCOMPATIBLE: {
    en: 'Cable kind incompatible with source or target node roles.',
    ar: 'نوع الكابل غير متوافق مع أدوار العقدة المصدر أو الهدف.'
  },
  POL_SEC_SSRF_EGRESS: {
    en: 'External network connections must pass through SSRFGuard.',
    ar: 'جميع الاتصالات بالشبكة الخارجية يجب أن تمر عبر حارس SSRFGuard.'
  },
  POL_ISOLATION_BREACH: {
    en: 'Department isolation breach: Line departments cannot directly wire to each other without Orchestrator.',
    ar: 'خرق لعزل الأقسام: لا يمكن ربط الأقسام التنفيذية مباشرة ببعضها دون المرور بمنسّق الأقسام.'
  }
};
