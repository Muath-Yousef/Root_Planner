import type { MessageEntry } from './cabling';

export const policyMessages: Record<string, MessageEntry> = {
  POL_DEFAULT_DENY: {
    en: 'Default Deny: Operation blocked because no explicit permission grant exists.',
    ar: 'الإنكار الافتراضي (Default Deny): العملية مرفوضة لعدم وجود إذن صريح يتيحها.'
  },
  POL_AUDIT_IMMUTABILITY: {
    en: 'Audit Immutability: Modifications to existing audit records are strictly prohibited.',
    ar: 'ثبات سجل التدقيق: يُمنع منعاً باتاً تعديل أو حذف أي سجل تدقيق سابق.'
  },
  POL_EVA_AMBIGUOUS_SCORE: {
    en: 'Ambiguous score (50.0–69.9): Escalated to founder for review.',
    ar: 'درجة ملاءمة ملتبسة (50.0–69.9): تم التصعيد إلى المؤسس للبت فيها.'
  },
  POL_EVA_UNSPECIFIED_BAND: {
    en: 'Unspecified score band (40.0–49.9): Fail-closed escalation enforced.',
    ar: 'نطاق درجات غير محدد في المرجع (40.0–49.9): تم التصعيد حتمياً وفق مبدأ الفشل-المغلق.'
  },
  POL_SCO_ALLOWLIST: {
    en: 'Scout Allowlist: Egress destination is not in the approved sources registry.',
    ar: 'قائمة المصادر المعتمدة: الوجهة الخارجية غير مسجلة في قائمة المصادر المعتمدة.'
  },
  POL_BUDGET_EXCEEDED: {
    en: 'Budget exceeded: Department cap reached or insufficient funds reserved.',
    ar: 'تجاوز الميزانية: تم استنفاد سقف القسم أو عدم كفاية المبلغ المحجوز.'
  },
  AUTH_FORBIDDEN: {
    en: 'Action forbidden: Permission explicitly prohibited by role policy.',
    ar: 'الإجراء محظور: الصلاحية محظورة صراحة في سياسة الدور.'
  },
  AUTH_MISSING_GRANT: {
    en: 'Missing permission grant for this action.',
    ar: 'صلاحية مفقودة: هذا الدور لا يملك تصريحاً لتنفيذ هذا الإجراء.'
  }
};
