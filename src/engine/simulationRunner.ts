import { AuditLogger, type AuditRecord, type ChainResult } from './auditLogger';
import { BudgetGuard } from './budgetGuard';
import { PolicyEngine } from './policyEngine';
import { decide, type Decision } from './scoringEngine';
import { usdToMicro, microToUsd } from './pricingCalculator';
import { validateRequest, type SsrfConfig } from './ssrfGuard';
import { NO_FAULTS, type SimFaults } from '../registry/scenarios';
import type { Principal } from '../types';

/**
 * Deterministic, event-by-event run of one objective through the opportunity-acquisition department.
 * Implements the 9-Step Lifecycle Loop of §3.1.3 verbatim.
 * Pure: no React, no DOM, no network.
 */
export interface L10n { en: string; ar: string }
export type StepStatus = 'ok' | 'warning' | 'blocked' | 'info';
export interface SimStep {
  index: number;
  /** §3.1.3 explicit step number (1 to 9, with 4+5 combined in single loop). */
  step_number: number | '4+5';
  id: string;
  actor: string;
  title: L10n;
  status: StepStatus;
  /** "Why did it stop / branch here?" in plain language. */
  why: L10n;
  payload: Record<string, unknown>;
  policy_id?: string;
  audit_id: string;
}
export type SimOutcome = Decision;
export interface SimOptions {
  fit_score: number;
  faults?: Partial<SimFaults>;
  ssrf: SsrfConfig;
  tenant_id?: string;
  department?: string;
  task_id?: string;
  logger?: AuditLogger;
}
export interface SimResult {
  task_id: string;
  outcome: SimOutcome;
  halted_reason?: string;
  steps: SimStep[];
  audit: AuditRecord[];
  chain: ChainResult;
}

const L = (en: string, ar: string): L10n => ({ en, ar });
const ACTORS = {
  founder: 'founder',
  orch: 'core.orchestrator.v1',
  mgr: 'opp_acq.manager.v1',
  scout: 'opp_acq.scout.v1',
  eva: 'opp_acq.evaluator.v1',
  str: 'opp_acq.strategist.v1',
  drf: 'opp_acq.drafter.v1',
} as const;

const principal = (
  employee_id: string,
  role: string,
  tenant_id: string,
  department: string,
  networkMode: Principal['networkMode']
): Principal => ({ employee_id, role, tenant_id, department, networkMode });

export async function runSimulation(opts: SimOptions): Promise<SimResult> {
  const faults: SimFaults = { ...NO_FAULTS, ...opts.faults };
  const tenant = opts.tenant_id ?? 'socroot-core';
  const dept = opts.department ?? 'dept_opportunity_acquisition';
  const task = opts.task_id ?? crypto.randomUUID();
  const logger = opts.logger ?? new AuditLogger();
  const engine = new PolicyEngine(opts.ssrf);
  const budget = new BudgetGuard();
  const steps: SimStep[] = [];
  const seen = new Set<string>(); // idempotency keys (message ids already processed)

  const emit = async (
    step_number: number | '4+5',
    actor: string,
    id: string,
    title: L10n,
    status: StepStatus,
    why: L10n,
    payload: Record<string, unknown> = {},
    policy_id?: string
  ) => {
    const rec = await logger.record(task, actor, id, { ...payload, status, ...(policy_id ? { policy_id } : {}) });
    steps.push({
      index: steps.length,
      step_number,
      id,
      actor,
      title,
      status,
      why,
      payload,
      policy_id,
      audit_id: rec.log_id,
    });
  };

  const finish = async (outcome: SimOutcome, halted_reason?: string): Promise<SimResult> => {
    // الخطوة 8: تحديث الحالة الدائمة في PostgreSQL مع القفل المتفائل (§3.1.3 Step 8)
    await emit(
      8,
      ACTORS.mgr,
      'STATE_UPDATE_PERSIST',
      L('Step 8: Update Persistent State with Optimistic Lock', 'الخطوة 8: تحديث الحالة الدائمة في PostgreSQL مع القفل المتفائل'),
      'ok',
      L(
        `Department manager updated state table with state_key="objective:${task}", status="${outcome.toLowerCase()}", and optimistic concurrency check.`,
        `قام مدير القسم بتحديث جدول الحالة الدائمة بمفتاح "objective:${task}" وحالة "${outcome.toLowerCase()}" مع فحص القفل المتفائل.`
      ),
      { state_key: `objective:${task}`, status: outcome.toLowerCase(), expected_version: 1 }
    );

    // الخطوة 9: تسجيل التدقيق النهائي بسلسلة SHA-256 وتسوية الميزانية (§3.1.3 Step 9)
    const rec = budget.reconcile(0);
    await emit(
      9,
      ACTORS.mgr,
      'BUDGET_RECONCILE',
      L('Step 9: Final SHA-256 Audit Chain & Budget Reconcile', 'الخطوة 9: تسجيل التدقيق النهائي بسلسلة SHA-256 وتسوية الميزانية'),
      'info',
      L(
        `Spent $${microToUsd(rec.spent)}; open reservations were released. Final event OBJECTIVE_COMPLETED sealed into SHA-256 hash chain.`,
        `المصروف $${microToUsd(rec.spent)}؛ حُرّرت الحجوزات المفتوحة فلا يبقى شيء محجوزاً، وأُغلِق الحدث النهائي OBJECTIVE_COMPLETED في سلسلة تدقيق SHA-256.`
      ),
      { event_type: 'OBJECTIVE_COMPLETED', spent_usd: microToUsd(rec.spent), released: rec.released }
    );
    return { task_id: task, outcome, halted_reason, steps, audit: [...logger.records], chain: await logger.verify() };
  };

  // ── الخطوة 1: استقبال الهدف والتحقق من صحته البنيوية والتسجيل الأثري (§3.1.3) ──
  await emit(
    1,
    ACTORS.mgr,
    'OBJECTIVE_RECEIVED',
    L('Step 1: Receive Objective & Record Audit', 'الخطوة 1: استقبال الهدف والتحقق من صحته البنيوية والتسجيل الأثري'),
    'ok',
    L(
      'The objective route packet was received over OBJECTIVE_ROUTE, validated against objective_route.schema.json, and recorded in audit log.',
      'استقبل مدير القسم الهدف عبر كابل OBJECTIVE_ROUTE، وتأكد من مطابقته لمخطط objective_route وسجّله في سجل التدقيق.'
    ),
    { tenant_id: tenant, department: dept, fit_score_input: opts.fit_score }
  );

  // ── الخطوة 2: تحليل الهدف وتفكيكه إلى مهام جزئية متسلسلة وموازية (§3.1.3) ──
  await emit(
    2,
    ACTORS.mgr,
    'OBJECTIVE_DECOMPOSED',
    L('Step 2: Objective Decomposition into Task Plan', 'الخطوة 2: تحليل الهدف وتفكيكه إلى مهام جزئية متسلسلة وموازية'),
    'ok',
    L(
      'Department planner decomposed the objective into an ordered plan of subtasks for scout, context, evaluator, strategist, and drafter.',
      'حلل المخطط الهدف وفككه إلى خطة مهام متسلسلة للمستطلع والسياق والمقيّم والاستراتيجي والصائغ.'
    ),
    { task_sequence: ['opp_acq.scout.v1', 'opp_acq.context.v1', 'opp_acq.evaluator.v1', 'opp_acq.strategist.v1', 'opp_acq.drafter.v1'] }
  );

  // ── الخطوة 3: التحقق المسبق من الميزانية وحجز المخصصات (§3.1.3) ──
  const estimate = faults.budget ? usdToMicro('0.45') : usdToMicro('0.12');
  const reserved = budget.reserve(task, dept, estimate);
  if (!reserved.ok) {
    const pol = engine.evaluate(principal(ACTORS.mgr, 'manager', tenant, dept, 'internal'), 'model:invoke', { budget_breach: true });
    await emit(
      3,
      ACTORS.mgr,
      'BUDGET_RESERVE',
      L('Step 3: Budget Reservation Refused', 'الخطوة 3: التحقق المسبق من الميزانية وحجز المخصصات (مرفوض)'),
      'blocked',
      L(
        `Stopped before any model call: ${reserved.reason} Nothing was spent, and the task escalates to the founder.`,
        `توقفت المهمة قبل أي استدعاء للنموذج: ${reserved.reason} لم يُصرف شيء وتُحال المهمة إلى المؤسس.`
      ),
      { error: reserved.error, estimate_usd: microToUsd(estimate) },
      pol.policy_id
    );
    // الخطوة 7: التصعيد للمؤسس عند التعثر
    await emit(
      7,
      ACTORS.mgr,
      'ESCALATION_PACKAGE',
      L('Step 7: Escalated to Human Founder', 'الخطوة 7: التصعيد للمؤسس البشري عند الفشل أو التعثر'),
      'warning',
      L(
        'An escalation package was sent over ESCALATION_PATH cable because the estimated budget exceeded limits.',
        'أُرسلت حزمة تصعيد عبر كابل ESCALATION_PATH لأن التقدير تجاوز السقف المالي المحدد.'
      ),
      { reason: pol.reason },
      pol.policy_id
    );
    return finish('ESCALATE', reserved.error);
  }
  await emit(
    3,
    ACTORS.mgr,
    'BUDGET_RESERVE',
    L('Step 3: Budget Reserved Atomically', 'الخطوة 3: التحقق المسبق من الميزانية وحجز المخصصات (معتمد)'),
    'ok',
    L(
      `$${microToUsd(estimate)} was frozen for this task so it cannot overspend (cap $${microToUsd(budget.taskCap)}).`,
      `جُمّد $${microToUsd(estimate)} لهذه المهمة كي لا تتجاوز الحد ($${microToUsd(budget.taskCap)}).`
    ),
    { estimate_usd: microToUsd(estimate), task_cap_usd: microToUsd(budget.taskCap) }
  );

  // ── الخطوتان 4+5: الإرسال والمراقبة الحثيثة للموظفين مع فحص قاطع الطوارئ وبوابة الإجهاض (§3.1.3) ──
  const scout = principal(ACTORS.scout, 'scout', tenant, dept, 'internal');
  const url = faults.ssrf
    ? 'http://169.254.169.254/latest/meta-data/'
    : opts.ssrf.approved_hosts[0]
      ? `https://${opts.ssrf.approved_hosts[0]}/`
      : null;

  if (url === null) {
    await emit(
      '4+5',
      ACTORS.scout,
      'SCOUT_FETCH',
      L('Steps 4+5: No Approved Source to Read', 'الخطوتان 4+5: استطلاع المصادر (لا يوجد مصدر معتمد للقراءة)'),
      'info',
      L(
        'The sources watchlist has no approved domains, so the scout skipped the web. Add one in sources_watchlist.yaml.',
        'قائمة المصادر لا تحوي نطاقات معتمدة فتخطّى الكشّاف الويب. أضف نطاقاً في sources_watchlist.yaml.'
      ),
      {}
    );
  } else {
    const v = validateRequest(url, 'GET', opts.ssrf);
    const pol = engine.evaluate(scout, v.ok ? 'web:read' : 'network:aws_imds', { url, method: 'GET' });
    if (v.ok) {
      await emit(
        '4+5',
        ACTORS.scout,
        'SCOUT_FETCH',
        L('Steps 4+5: Scout Read Approved Source', 'الخطوتان 4+5: استطلاع المصادر وقراءة موقع معتمد عبر SSRFGuard'),
        'ok',
        L(
          `${v.host} is on the allowlist and the method is read-only, so the SSRF guard let the request through.`,
          `${v.host} ضمن القائمة المعتمدة والطلب للقراءة فقط فمرّر حارس SSRF الطلب.`
        ),
        { url, method: 'GET' },
        pol.policy_id
      );
    } else {
      await emit(
        '4+5',
        ACTORS.scout,
        'SCOUT_FETCH',
        L('Steps 4+5: Request Blocked by SSRF Guard', 'الخطوتان 4+5: حظر محاولة اختراق بواسطة حارس SSRF'),
        'blocked',
        L(
          `${v.reason} The attempt was logged; the task continues without this source.`,
          `${v.reason} سُجّلت المحاولة وحُظرت، وتستمر المهمة بدون هذا المصدر منعاً للاختراق.`
        ),
        { url, method: 'GET', ssrf_code: v.code },
        v.code === 'SSRF_PRIVATE_IP' ? pol.policy_id : undefined
      );
    }
  }

  // Dispatch to evaluator with Kill Switch assertion and idempotency check
  const messageId = `${task}:dispatch:evaluator`;
  seen.add(messageId);
  await emit(
    '4+5',
    ACTORS.mgr,
    'TASK_DISPATCH',
    L('Steps 4+5: Task Dispatched to Evaluator', 'الخطوتان 4+5: التحقق من قاطع الطوارئ وإرسال المهمة للمقيّم'),
    'ok',
    L(
      'Manager checked kill-switch status (employee active) and dispatched task_dispatch via transactional outbox.',
      'تحقق المدير من قاطع الطوارئ (الموظف نشط) وأرسل رسالة task_dispatch عبر صندوق الصادر الموثوق.'
    ),
    { message_id: messageId, to: ACTORS.eva, kill_switch_active: true }
  );

  if (faults.duplicate) {
    const dup = seen.has(messageId);
    await emit(
      '4+5',
      ACTORS.eva,
      'DUPLICATE_DROPPED',
      L('Steps 4+5: Duplicate Message Dropped', 'الخطوتان 4+5: إسقاط رسالة مكررة بواسطة مفتاح عدم التكرار'),
      dup ? 'blocked' : 'ok',
      L(
        'The same message_id arrived twice. Idempotency key dropped the second copy with no second model call.',
        'وصل المعرّف نفسه مرتين. أسقط مفتاح عدم التكرار النسخة الثانية دون إعادة تشغيل الأدوات أو استدعاء النماذج.'
      ),
      { message_id: messageId, deliveries: 2, processed: 1 }
    );
  }

  // ── استدعاء النماذج وبوابة الإجهاض المبكر لمنع هدر الموارد (§3.1.3) ──
  if (faults.failover) {
    await emit(
      '4+5',
      ACTORS.eva,
      'MODEL_FAILOVER',
      L('Steps 4+5: Model Failed Over to Secondary', 'الخطوتان 4+5: تحوّل النموذج اللغوي إلى البديل بعد خطأ 429/503'),
      'warning',
      L(
        'The primary model answered 429/503. The router retried on fallback model and succeeded.',
        'أجاب النموذج الأساسي بـ 429/503 (مشغول أو متوقف). أعاد الموجّه المحاولة على النموذج البديل فنجحت.'
      ),
      { attempts: [{ model: 'primary', status: 429 }, { model: 'fallback', status: 200 }] }
    );
  }

  const actual = usdToMicro('0.08');
  const committed = budget.commit(task, actual);
  await emit(
    '4+5',
    ACTORS.eva,
    'MODEL_INVOKE',
    L('Steps 4+5: Model Invocation & Cost Commitment', 'الخطوتان 4+5: استدعاء نموذج التقييم وتثبيت التكلفة الفعلية'),
    committed.ok ? 'ok' : 'blocked',
    L(
      `Actual cost $${microToUsd(actual)} was committed; unused part of reservation released.`,
      `سُجّلت التكلفة الفعلية $${microToUsd(actual)} وحُرّر الفائض المتبقي من الحجز.`
    ),
    { actual_usd: microToUsd(actual) }
  );

  // Early Abort Gate (§3.1.3: if score < 40.0 -> early abort)
  const d = decide(opts.fit_score);
  const pol = engine.evaluate(
    principal(ACTORS.eva, 'evaluator', tenant, dept, 'none'),
    'evaluator:score_submit',
    { fit_score: opts.fit_score }
  );
  const policy_id = d.policy ?? (pol.outcome === 'REQUIRE_ESCALATION' ? pol.policy_id : undefined);
  const decisionWhy: Record<Decision, L10n> = {
    FAST_TRACK: L(
      `Score ${opts.fit_score} >= 85.0: fast track triggers, skipping strategist step and proceeding directly to drafting.`,
      `الدرجة ${opts.fit_score} >= 85.0: مسار سريع يتجاوز مرحلة الاستراتيجية ويمرّر التكليف مباشرة للصياغة.`
    ),
    PROCEED: L(
      `Score ${opts.fit_score} is between 70.0 and 84.9: standard progression through strategist.`,
      `الدرجة ${opts.fit_score} بين 70.0 و84.9: مسار اعتيادي يستكمل التسلسل عبر الاستراتيجي.`
    ),
    ESCALATE: L(
      d.note ??
        `Score ${opts.fit_score} is in ambiguity zone: POL_EVA_AMBIGUOUS_SCORE triggers immediate escalation to founder.`,
      d.note ??
        `الدرجة ${opts.fit_score} في منطقة الغموض: تفعيل POL_EVA_AMBIGUOUS_SCORE والتصعيد الفوري للمؤسس البشري.`
    ),
    ABORT: L(
      `Score ${opts.fit_score} < 40.0: early abort gate triggers immediately to prevent resource and budget waste.`,
      `الدرجة ${opts.fit_score} < 40.0: تفعيل بوابة الإجهاض المبكر فوراً لمنع هدر الميزانية وموارد التشغيل.`
    ),
  };

  await emit(
    '4+5',
    ACTORS.eva,
    'EVALUATOR_DECISION',
    L(`Steps 4+5: Evaluator Decision (${d.decision})`, `الخطوتان 4+5: قرار بوابة التقييم الحاكمة (${d.decision})`),
    d.decision === 'ABORT' || d.decision === 'ESCALATE' ? 'warning' : 'ok',
    decisionWhy[d.decision],
    { decision: d.decision, band: d.band, fit_score: opts.fit_score },
    policy_id
  );

  // Early abort path per §3.1.3: returns self._build_abort_result immediately without steps 6–9
  if (d.decision === 'ABORT') {
    await emit(
      '4+5',
      ACTORS.mgr,
      'ABORT_REPORT',
      L('Steps 4+5: Early Abort Result', 'الخطوتان 4+5: نتيجة الإجهاض المبكر'),
      'warning',
      L(
        'Execution halted early at evaluator gate. Abort report generated explaining low fit score without spending remaining budget.',
        'أُوقف التنفيذ مبكراً عند بوابة التقييم. تم توليد تقرير أسباب الإجهاض لشرح انخفاض درجة الملاءمة دون استنزاف باقي الميزانية.'
      ),
      { fit_score: opts.fit_score }
    );
    return {
      task_id: task,
      outcome: 'ABORT',
      halted_reason: 'Early abort gate triggered: fit_score < 40.0',
      steps,
      audit: [...logger.records],
      chain: await logger.verify(),
    };
  }

  // ── متابعة الحلقة: إرسال الاستراتيجي والصائغ ──
  const drafterNote = L(
    'The drafter has zero network egress (POL_DRF_HARD_01); works strictly from local memory and context.',
    'الصائغ معزول شبكياً بالكامل (POL_DRF_HARD_01)؛ يعمل حصراً من الذاكرة المحلية والسياق المسلّم.'
  );

  if (d.decision === 'PROCEED') {
    await emit(
      '4+5',
      ACTORS.str,
      'TASK_DISPATCH',
      L('Steps 4+5: Strategist Formulates Winning Strategy', 'الخطوتان 4+5: صياغة استراتيجية الفوز وزوايا التقديم'),
      'ok',
      L('The strategist reads L2 memory and formulates winning strategy angles before drafting.', 'يقرأ الاستراتيجي ذاكرة L2 ويصوغ زوايا الفوز تمهيداً للصياغة.'),
      { to: ACTORS.str }
    );
  }

  if (d.decision === 'FAST_TRACK' || d.decision === 'PROCEED') {
    await emit(
      '4+5',
      ACTORS.drf,
      'TASK_DISPATCH',
      L('Steps 4+5: Drafter Assembles Proposal Sections', 'الخطوتان 4+5: الصائغ يجمع مسودة العرض والمستندات'),
      'ok',
      drafterNote,
      { to: ACTORS.drf }
    );
    // ── الخطوة 6: التحقق من صحة المخرجات النهائية والامتثال للـ SLA (§3.1.3) ──
    await emit(
      6,
      ACTORS.drf,
      'TASK_RESULT',
      L('Step 6: Validate Final Output & SLA Compliance', 'الخطوة 6: التحقق من صحة المخرجات النهائية والامتثال للـ SLA'),
      'ok',
      L(
        'Final result passed task_result schema validation and SLA check. External submission requires founder approval.',
        'اجتازت النتيجة النهائية فحص مخطط task_result والامتثال للـ SLA. التقديم الخارجي يتطلب اعتماد المؤسس (POL_EXT_SUBMISSION).'
      ),
      { sla_compliant: true, schema_validated: true },
      'POL_EXT_SUBMISSION'
    );
  }

  // ── الخطوة 7: التصعيد للمؤسس البشري عند الفشل أو التعثر (يُنفَّذ عند الضرورة) (§3.1.3) ──
  if (d.decision === 'ESCALATE') {
    await emit(
      7,
      ACTORS.mgr,
      'ESCALATION_PACKAGE',
      L('Step 7: Escalation Package Dispatched to Founder', 'الخطوة 7: التصعيد للمؤسس البشري عند الفشل أو التعثر'),
      'warning',
      L(
        'Task paused intentionally. Founder receives complete escalation package with evidence to decide or intervene.',
        'توقفت المهمة عمداً. يستلم المؤسس حزمة التصعيد مع الأدلة لاتخاذ القرار أو التوجيه.'
      ),
      { fit_score: opts.fit_score },
      policy_id
    );
  }

  // خطوات 8 و 9 داخل finish()
  return finish(d.decision);
}
