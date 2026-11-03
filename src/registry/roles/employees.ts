import type { RoleDefinition } from '../definitions';

type Perm = { grants: string[]; prohibitions: string[]; source: 'reference' | 'derived' };
const STATE = ['storage:state_read', 'storage:state_write'];
const TASK = ['task:read', 'task:complete'];
const sk = (name: string, title: string, rules: string[]) => ({ name, body: `---\nname: ${name.replace('.md', '')}\nscope: ${title}\n---\n# ${title}\n\n## Rules\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n## Decision rules\n- IF evidence is missing THEN treat the criterion as not met (fail-closed).\n- IF the request is outside this role's scope THEN escalate to the manager.\n` });

interface E {
  id: string; en: string; ar: string; descEn: string; descAr: string; mission: string; network: NetworkMode;
  perms: Perm; tools: [string, string][]; scorecard: string[]; autonomy?: number; hardNoEgress?: boolean;
  horizon?: RoleDefinition['architecture_horizon']; status?: RoleDefinition['implementation_status']; exclusions?: string[]; secrets?: { name: string; ref: string }[]; policies?: string[];
}
type NetworkMode = 'internal' | 'isolated' | 'none';

const emp = (e: E): RoleDefinition => ({
  id: e.id, kind: 'employee', category: 'Employees', ref: '§6.3.2',
  label: { en: e.en, ar: e.ar }, description: { en: e.descEn, ar: e.descAr },
  architecture_horizon: e.horizon ?? 'CURRENT', implementation_status: e.status ?? 'IMPLEMENTED',
  inspector: ['identity', 'contract', 'manifest', 'code', 'tools', 'policies'], schema_ref: 'contract',
  network: e.network, hard_no_egress: e.hardNoEgress, permissions: e.perms,
  employee: {
    name: { en: e.en, ar: e.ar }, mission: e.mission, scope: e.tools.map(([, d]) => d), exclusions: e.exclusions ?? ['Does not exceed the scope of its role', 'Does not commit funds'],
    autonomy_level: e.autonomy ?? 1,
    tools: e.tools.map(([tool_id, description]) => ({ tool_id, description, is_idempotent: true })),
    policies: e.policies ?? ['POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
    runtime: { max_concurrent_tasks: 5, task_timeout_seconds: 60 },
    identity_prompt: `You are the ${e.en} of the Socroot digital organization. ${e.mission} Rely on objective evidence only.`,
    skills: [sk(`${e.id}_playbook.md`, `${e.en} playbook`, [`Stay inside the ${e.id} role.`, 'Cite the evidence behind every conclusion.', 'Never include unverified numbers.'])],
    secrets: e.secrets, scorecard: e.scorecard,
  },
});
const ref = (grants: string[], prohibitions: string[]): Perm => ({ grants, prohibitions, source: 'reference' });
const derived = (grants: string[], prohibitions: string[]): Perm => ({ grants, prohibitions, source: 'derived' });

const defs: RoleDefinition[] = [
  emp({ id: 'scout', en: 'Scout', ar: 'المستطلع', descEn: 'Surveys approved external sources. Read-only, only through SSRFGuard.', descAr: 'يستطلع المصادر الخارجية المعتمدة. قراءة فقط وعبر SSRFGuard حصراً.',
    mission: 'Survey the approved external sources and collect candidate opportunities.', network: 'internal',
    perms: ref(['web:read', 'model:invoke', ...STATE, ...TASK], ['web:write', 'web:post', 'external:submit', 'funds:*']),
    tools: [['fetch_approved_source', 'Fetch a page from an approved source through SSRFGuard'], ['parse_listing', 'Extract opportunity fields from a listing']],
    scorecard: ['link_extraction_accuracy', 'approved_domain_compliance', 'response_speed'], policies: ['POL_SCO_ALLOWLIST', 'POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
    secrets: [{ name: 'SOURCE_API_KEY', ref: 'vault://depts/opp_acq/source_api_key' }] }),
  emp({ id: 'context', en: 'Context', ar: 'السياق', descEn: 'Extracts text and evidence and prepares the vector memory.', descAr: 'يستخلص النصوص والأدلة ويجهّز الذاكرة المتجهية.',
    mission: 'Extract text and evidence and prepare the working context.', network: 'internal',
    perms: ref(['web:read', 'model:invoke', ...STATE, 'storage:vector_read', 'storage:vector_write', ...TASK], ['external:submit', 'funds:*', 'storage:audit_modify']),
    tools: [['extract_evidence', 'Extract evidence passages from collected pages'], ['build_context_pack', 'Assemble the context pack for the evaluator']],
    scorecard: ['evidence_precision', 'tenant_isolation_in_retrieval', 'context_token_efficiency'] }),
  emp({ id: 'evaluator', en: 'Evaluator', ar: 'المقيّم', descEn: 'Scores eligibility and fit. No network; cannot write vector memory.', descAr: 'يقيّم الأهلية والملاءمة. بلا شبكة ولا كتابة في المتجهات.',
    mission: 'Evaluate the eligibility and fit of opportunities deterministically and objectively.', network: 'none', hardNoEgress: true, autonomy: 2,
    perms: ref(['model:invoke', ...STATE, 'storage:vector_read', ...TASK], ['web:*', 'external:*', 'funds:*', 'storage:audit_modify']),
    tools: [['calculate_fit_score', 'Compute fit score with a deterministic weighted formula'], ['check_eligibility_criteria', 'Check the mandatory eligibility criteria']],
    scorecard: ['arithmetic_determinism', 'zero_guessing', 'early_abort_compliance'], policies: ['POL_EVA_AMBIGUOUS_SCORE', 'POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'],
    exclusions: ['Does not write the final proposal', 'Does not contact any external party over the network', 'Does not commit any funds'] }),
  emp({ id: 'strategist', en: 'Strategist', ar: 'الاستراتيجي', descEn: 'Shapes the winning strategy from the evaluation outputs.', descAr: 'يصوغ استراتيجية الفوز من مخرجات التقييم.',
    mission: 'Define the winning strategy and the angles of the submission.', network: 'none',
    perms: ref(['model:invoke', ...STATE, 'storage:vector_read', ...TASK], []),
    tools: [['build_win_strategy', 'Build the winning strategy from evaluation outputs'], ['rank_submission_angles', 'Rank candidate angles by fit']],
    scorecard: ['strategy_grounding', 'evaluation_dependency_compliance', 'angle_diversity'] }),
  emp({ id: 'drafter', en: 'Drafter', ar: 'الصائغ', descEn: 'Writes proposals. Zero network by design (POL_DRF_HARD_01).', descAr: 'يصوغ العروض. بلا شبكة بالتصميم (POL_DRF_HARD_01).',
    mission: 'Write proposals and formal documents with complete sections.', network: 'none', hardNoEgress: true, autonomy: 2,
    perms: ref(['model:invoke', ...STATE, 'storage:vector_read', ...TASK], ['web:*', 'external:*', 'funds:*', 'storage:audit_modify']),
    tools: [['assemble_proposal_sections', 'Assemble the proposal sections'], ['verify_section_completeness', 'Verify every required section is present']],
    scorecard: ['section_completeness', 'style_consistency', 'context_leak_free'], policies: ['POL_DRF_HARD_01', 'POL_DEFAULT_DENY', 'POL_AUDIT_IMMUTABILITY'] }),
  // Roles 6-13 of §6.3.2. The reference gives no ROLE_PERMISSIONS row for them: grants are derived least-privilege (G-03).
  emp({ id: 'compliance', en: 'Compliance', ar: 'الامتثال', descEn: 'Audits compliance with conditions and regulations.', descAr: 'يدقق الامتثال للشروط واللوائح.',
    mission: 'Audit compliance with the conditions and legal regulations.', network: 'none', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'storage:vector_read', ...TASK], ['web:*', 'external:*', 'funds:*', 'storage:audit_modify']),
    tools: [['check_regulation_match', 'Check a document against regulation rules']], scorecard: ['rule_coverage', 'false_clear_rate'] }),
  emp({ id: 'financial_controller', en: 'Financial Controller', ar: 'المراقب المالي', descEn: 'Audits budgets and cost flows. Any commitment needs a founder signature.', descAr: 'يدقق الميزانيات والتكاليف. أي التزام مالي يتطلب توقيع المؤسس.',
    mission: 'Audit budgets and track cost flows.', network: 'internal', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'audit:read', ...TASK], ['web:*', 'funds:commit', 'funds:allocate', 'storage:audit_modify']),
    tools: [['inspect_spend', 'Inspect spend per department']], scorecard: ['reconciliation_accuracy', 'overrun_detection'] }),
  emp({ id: 'security_guard', en: 'Security Guard', ar: 'الحارس الأمني', descEn: 'Audits policies, detects intrusion and prompt injection.', descAr: 'يدقق السياسات ويكشف محاولات الاختراق وحقن الأوامر.',
    mission: 'Audit policies and detect intrusion and prompt-injection attempts.', network: 'internal', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'audit:read', 'metrics:read', ...TASK], ['web:*', 'funds:*', 'storage:audit_modify']),
    tools: [['scan_input', 'Scan input for injection patterns']], scorecard: ['detection_rate', 'false_positive_rate'] }),
  emp({ id: 'systems_engineer', en: 'Systems Engineer', ar: 'مهندس الأنظمة', descEn: 'Maintains the workspace and tooling inside isolated test environments only.', descAr: 'يصون مساحة العمل والأدوات داخل بيئات اختبار معزولة فقط.',
    mission: 'Maintain the workspace and tooling inside isolated test environments.', network: 'isolated', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'storage:state_write', ...TASK], ['web:*', 'funds:*', 'storage:audit_modify']),
    tools: [['run_in_sandbox', 'Run a change inside the isolated sandbox']], scorecard: ['sandbox_containment', 'change_success_rate'] }),
  emp({ id: 'knowledge_custodian', en: 'Knowledge Custodian', ar: 'أمين المعرفة', descEn: 'Indexes knowledge and curates the long-term semantic memory.', descAr: 'يفهرس المعرفة ويحدّث الذاكرة الدلالية طويلة المدى.',
    mission: 'Index knowledge and update the long-term semantic memory.', network: 'internal', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'storage:vector_read', 'storage:vector_write', ...TASK], ['external:submit', 'funds:*', 'storage:audit_modify']),
    tools: [['index_document', 'Index a document into a vector namespace'], ['sanitize_namespace', 'Sanitize a vector namespace']], scorecard: ['retrieval_recall', 'namespace_leak_free'] }),
  emp({ id: 'performance_analyst', en: 'Performance Analyst', ar: 'محلل الأداء', descEn: 'Measures employee accuracy, success rates and execution time.', descAr: 'يقيس دقة الموظفين ومعدلات النجاح وزمن التنفيذ.',
    mission: 'Measure employee accuracy, success rates and execution time.', network: 'internal', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['model:invoke', 'storage:state_read', 'audit:read', 'metrics:read', ...TASK], ['web:*', 'funds:*', 'storage:audit_modify']),
    tools: [['compute_success_rates', 'Compute success rates from audit records']], scorecard: ['metric_accuracy', 'report_timeliness'] }),
  emp({ id: 'integration_spec', en: 'Integration Specialist', ar: 'أخصائي التكامل', descEn: 'Builds external integrations with limited, logged network access.', descAr: 'يبني واجهات الربط الخارجية بصلاحيات شبكية محدودة ومراقبة.',
    mission: 'Build and manage external integration interfaces.', network: 'internal', horizon: 'TRANSITIONAL', status: 'PLANNED',
    perms: derived(['web:read', 'model:invoke', 'storage:state_read', 'storage:state_write', ...TASK], ['external:submit', 'funds:*', 'storage:audit_modify']),
    tools: [['call_registered_integration', 'Call a registered integration through SSRFGuard']], scorecard: ['contract_conformance', 'egress_logging_complete'] }),
];
export default defs;
