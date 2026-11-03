import type { PolicyContext, PolicyDecision, Principal } from '../types';
import { isPermitted } from './permissionStore';
import { isDomainApproved, type SsrfConfig } from './ssrfGuard';

export class HardDenyViolationError extends Error { constructor(m: string) { super(m); this.name = 'HardDenyViolationError'; } }
export class ApprovalRequiredError extends Error { constructor(m: string) { super(m); this.name = 'ApprovalRequiredError'; } }
export class EscalationRequiredError extends Error { constructor(m: string) { super(m); this.name = 'EscalationRequiredError'; } }

const d = (policy_id: string, outcome: PolicyDecision['outcome'], reason: string, tier: PolicyDecision['tier']): PolicyDecision => ({ policy_id, outcome, reason, tier });
const isNetAction = (a: string) => a.includes('web') || a.includes('external') || a.startsWith('network:') || a.startsWith('net.');

/**
 * §4.3.2 — five tiers, evaluated in order, none skippable.
 * Tier 1 hard deny · 2 require approval · 3 require escalation · 4 conditional allow (RBAC + ABAC) · 5 default deny.
 * Anything that throws inside evaluation is denied (fail-closed, §1.5.2).
 */
export class PolicyEngine {
  constructor(private readonly ssrf: SsrfConfig = { approved_hosts: [], blocked_ip_ranges: [], methods: ['GET', 'HEAD'] }) {}

  evaluate(p: Principal, action: string, ctx: PolicyContext = {}): PolicyDecision {
    try { return this.run(p, action, ctx); } catch (e) { return d('POL_DEFAULT_DENY', 'DENY', `Fail-closed after an internal error: ${e instanceof Error ? e.message : String(e)}`, 5); }
  }

  private run(p: Principal, action: string, ctx: PolicyContext): PolicyDecision {
    const { role } = p;
    // Tier 1 — hard deny
    if ((role === 'drafter' || p.networkMode === 'none') && isNetAction(action))
      return d('POL_DRF_HARD_01', 'DENY', role === 'drafter' ? 'Drafter: ZERO network egress allowed.' : `Network mode is none for ${p.employee_id}: ZERO network egress allowed.`, 1);
    if (['audit_modify', 'audit_delete', 'storage:audit_modify'].includes(action)) return d('POL_AUDIT_IMMUTABILITY', 'DENY', 'Audit log is strictly immutable.', 1);
    if (['network:private_ip', 'network:aws_imds'].includes(action)) return d('POL_SSRF_HARD_BLOCK', 'DENY', 'SSRF Guard: Internal and Cloud metadata IPs are blocked.', 1);
    // Tier 2 — cryptographic approval
    if (['funds:commit', 'funds:allocate'].includes(action) && !ctx.founder_signed_token) return d('POL_FIN_APPROVAL', 'REQUIRE_APPROVAL', 'Financial commitment requires valid founder token.', 2);
    if (action === 'external:submit_proposal' && !ctx.founder_approved) return d('POL_EXT_SUBMISSION', 'REQUIRE_APPROVAL', 'External proposal submission requires founder approval.', 2);
    // Tier 3 — escalation
    if (action === 'evaluator:score_submit') {
      const s = ctx.fit_score ?? 0;
      if (s >= 50.0 && s <= 69.9) return d('POL_EVA_AMBIGUOUS_SCORE', 'REQUIRE_ESCALATION', `Fit score ${s} falls within ambiguous evaluation range.`, 3);
      // §3.3.1 leaves 40.0–49.9 undefined; fail closed (G-05).
      if (s >= 40.0 && s < 50.0) return d('POL_EVA_UNSPECIFIED_BAND', 'REQUIRE_ESCALATION', `Fit score ${s} is between the abort and ambiguous bands, which the reference does not define. Escalated (fail-closed).`, 3);
    }
    if (action === 'model:invoke' && ctx.budget_breach) return d('POL_BUDGET_CAP_BREACH', 'REQUIRE_ESCALATION', 'Department daily budget cap exceeded.', 3);
    // Tier 4 — conditional allow
    if (ctx.kill_active) return d('POL_ABAC_KILL_ACTIVE', 'DENY', 'A kill switch is active for this principal (IAM-003).', 4);
    if (ctx.tenant_id && ctx.tenant_id !== p.tenant_id) return d('POL_ABAC_TENANT', 'DENY', `Resource belongs to tenant ${ctx.tenant_id}, not ${p.tenant_id}.`, 4);
    if (ctx.confidentiality !== undefined && ctx.confidentiality > (ctx.clearance ?? 0)) return d('POL_ABAC_CONFIDENTIALITY', 'DENY', `DATA_CONFIDENTIALITY_LEVEL ${ctx.confidentiality} is above clearance ${ctx.clearance ?? 0}.`, 4);
    if (role === 'scout' && action === 'web:read') {
      const host = (() => { try { return new URL(ctx.url ?? '').hostname.toLowerCase(); } catch { return ''; } })();
      if (host && isDomainApproved(host, this.ssrf.approved_hosts) && ['GET', 'HEAD'].includes((ctx.method ?? '').toUpperCase()))
        return d('POL_SCO_ALLOWLIST', 'ALLOW', 'Scout accessing pre-approved domain with read-only method.', 4);
    }
    if (isPermitted(role, action)) return d('POL_RBAC_GRANT', 'ALLOW', `RBAC: role '${role}' granted action '${action}'.`, 4);
    // Tier 5 — default deny
    return d('POL_DEFAULT_DENY', 'DENY', `No explicit policy grant found for role '${role}' and action '${action}'.`, 5);
  }

  /** §4.3.3: translate a decision into a stopping exception. */
  enforce(p: Principal, action: string, ctx: PolicyContext = {}): PolicyDecision {
    const x = this.evaluate(p, action, ctx);
    const msg = `[${x.policy_id}] ${x.reason}`;
    if (x.outcome === 'DENY') throw new HardDenyViolationError(msg);
    if (x.outcome === 'REQUIRE_APPROVAL') throw new ApprovalRequiredError(msg);
    if (x.outcome === 'REQUIRE_ESCALATION') throw new EscalationRequiredError(msg);
    return x;
  }
}
