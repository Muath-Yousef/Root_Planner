import type { MessageEntry } from './cabling';

export const cliMessages: Record<string, MessageEntry> = {
  CLI_SHELL_REJECTED: {
    en: 'Shell syntax is not accepted. socroot-admin takes one command from the fixed tree and nothing else.',
    ar: 'صيغ الشل والأوامر المتسلسلة مرفوضة تماماً. يقبل socroot-admin أمراً واحداً من الشجرة الثابتة فقط.'
  },
  CLI_SYNTAX: {
    en: 'A quote was opened and never closed.',
    ar: 'خطأ نحوي: تم فتح علامة تنصيص ولم يتم إغلاقها.'
  },
  CLI_EMPTY: {
    en: 'Type a command, for example: socroot-admin budget inspect --dept dept_opportunity_acquisition',
    ar: 'اكتب أمراً، مثال: socroot-admin budget inspect --dept dept_opportunity_acquisition'
  },
  CLI_UNKNOWN: {
    en: 'Unknown command group. Allowed groups: employee, kill-switch, budget, audit.',
    ar: 'مجموعة أوامر مجهولة. المجموعات المعتمدة: employee, kill-switch, budget, audit.'
  },
  CLI_UNKNOWN_VERB: {
    en: 'Unknown verb for group. Check usage for allowed operations.',
    ar: 'فعل مجهول للمجموعة. تحقق من دليل الاستخدام لمعرفة العمليات المتاحة.'
  },
  CLI_MISSING_ARG: {
    en: 'Missing required flag. Please provide all required arguments.',
    ar: 'راية مطلوبة مفقودة. يرجى تزويد كافة المعاملات الإلزامية للأمر.'
  },
  CLI_FLAG_NEEDS_VALUE: {
    en: 'Flag needs a value following it.',
    ar: 'الراية تتطلب قيمة بعدها.'
  },
  CLI_UNKNOWN_FLAG: {
    en: 'Unknown flag. Please check the command arguments.',
    ar: 'راية غير معروفة. يرجى مراجعة معاملات الأمر.'
  },
  CLI_BAD_LEVEL: {
    en: 'Invalid kill level. Must be one of: TASK, EMPLOYEE, DEPARTMENT, GLOBAL.',
    ar: 'مستوى قاطع طوارئ غير صالح. يجب أن يكون: TASK أو EMPLOYEE أو DEPARTMENT أو GLOBAL.'
  },
  CLI_BAD_AMOUNT: {
    en: 'Invalid USD amount. Must be a positive numeric value.',
    ar: 'مبلغ دولار غير صالح. يجب أن يكون قيمة رقمية موجبة.'
  },
  CLI_ASSISTANT_REFUSED: {
    en: 'Advisory assistant refused to execute. The assistant can only plan, not mutate state (OPS-002).',
    ar: 'رفض المساعد الاستشاري التنفيذ: دور المساعد يقتصر على التخطيط فقط ولا ينفذ تغييرات الحالة (OPS-002).'
  },
  CLI_NEEDS_CONFIRM: {
    en: 'Mutating command requires typing CONFIRM explicitly.',
    ar: 'الأمر المغير للحالة يتطلب كتابة كلمة CONFIRM صراحة للتأكيد.'
  },
  CLI_KILL_ACTIVATED: {
    en: 'Kill switch engaged successfully.',
    ar: 'تم تفعيل قاطع الطوارئ بنجاح.'
  },
  CLI_KILL_DEACTIVATED: {
    en: 'Kill switch released successfully.',
    ar: 'تم تحرير قاطع الطوارئ بنجاح.'
  },
  CLI_BUDGET_SET: {
    en: 'Department budget limit updated successfully.',
    ar: 'تم تحديث سقف ميزانية القسم بنجاح.'
  },
  CLI_AUDIT_OK: {
    en: 'Audit chain verified intact with valid SHA-256 links.',
    ar: 'تم التحقق من سلامة سلسلة التدقيق بنجاح مع روابط SHA-256 صحيحة.'
  }
};
