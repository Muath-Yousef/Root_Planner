import type { MessageEntry } from './cabling';

export const breakGlassMessages: Record<string, MessageEntry> = {
  BG_NONCE_REPLAY: {
    en: 'Replay attack detected: Nonce has already been consumed.',
    ar: 'تم اكتشاف هجوم إعادة إرسال: تم استهلاك الرمز المفرغ (Nonce) مسبقاً.'
  },
  BG_EXPIRED: {
    en: 'Break-glass token has expired (TTL exceeded 900s).',
    ar: 'انتهت صلاحية رمز الطوارئ (تجاوز العمر الزمني 900 ثانية).'
  },
  BG_AMOUNT_EXCEEDED: {
    en: 'Requested amount exceeds authorized break-glass limit.',
    ar: 'المبلغ المطلوب يتجاوز السقف المصرح به في جلسة الطوارئ.'
  },
  BG_INVALID_TARGET: {
    en: 'Target resource does not match break-glass authorization.',
    ar: 'المورد المستهدف لا يتطابق مع تفويض رمز الطوارئ.'
  },
  BG_SIGNATURE_INVALID: {
    en: 'Invalid Ed25519 cryptographic signature on founder token.',
    ar: 'توقيع Ed25519 التشفيري غير صالح لرمز المؤسس.'
  }
};

export const gateMessages: Record<string, MessageEntry> = {
  GATE_RULE_OF_THREE: {
    en: 'Rule of Three: Department must contain at least three distinct employee roles.',
    ar: 'قاعدة الثلاثة: يجب أن يحتوي القسم على 3 أدوار وظيفية مختلفة على الأقل.'
  },
  GATE_TRUST_BOUNDARY: {
    en: 'Trust boundary: Evaluator and Drafter must have zero egress capability.',
    ar: 'حد الثقة الحتمي: يجب حظر خروج البيانات للإنترنت عن المقيّم والصائغ.'
  },
  GATE_SCHEMA_VALIDATION: {
    en: 'Schema validation: Artifact violates JSON schema specifications.',
    ar: 'التحقق من المخطط: التحفة البرمجية تخالف مواصفات مخطط JSON المعتمد.'
  },
  GATE_SYNTHETIC_BENCHMARK: {
    en: 'Synthetic benchmark failed to meet required threshold.',
    ar: 'فشل الاختبار التركيبي في تحقيق العتبة المطلوبة للأداء.'
  },
  GATE_SECRET_SCAN: {
    en: 'Secret scan: Hardcoded secret detected. Must use vault:// references.',
    ar: 'فحص الأسرار: تم اكتشاف سر صريح. يجب استخدام مراجع vault:// حصراً.'
  }
};
