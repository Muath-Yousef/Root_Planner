import { describe, expect, it } from 'vitest';
import { fnmatch, isPermitted } from '../src/engine/permissionStore';
import { PolicyEngine, HardDenyViolationError, ApprovalRequiredError, EscalationRequiredError } from '../src/engine/policyEngine';
import { parseWatchlist } from '../src/engine/ssrfGuard';
import { SOURCES_WATCHLIST_YAML } from '../src/presets/defaultConfigs';
import type { Principal } from '../src/types';

const P = (role: string, over: Partial<Principal> = {}): Principal => ({ employee_id: `opp_acq.${role}.v1`, role, tenant_id: 'socroot-core', department: 'd', networkMode: role === 'drafter' || role === 'evaluator' ? 'none' : 'internal', ...over });
const engine = new PolicyEngine(parseWatchlist(SOURCES_WATCHLIST_YAML));

describe('fnmatch', () => {
  it.each([
    ['web:*', 'web:read', true], ['web:*', 'external:x', false], ['?at', 'cat', true], ['?at', 'at', false], ['[abc]x', 'bx', true],
    ['[!abc]x', 'bx', false], ['[!abc]x', 'dx', true], ['a.b', 'axb', false], ['*', '', true], ['storage:*', 'storage:audit_modify', true], ['L[1-3]/*', 'L4/x', false],
  ])('%s vs %s -> %s', (pat, s, want) => expect(fnmatch(pat, s)).toBe(want));
  it('is case sensitive', () => expect(fnmatch('Abc', 'abc')).toBe(false));
});

describe('RBAC (§4.2.2): prohibitions first, then grants, then default deny', () => {
  it('drafter and evaluator never get web access, scout does', () => {
    expect(isPermitted('drafter', 'web:read')).toBe(false); expect(isPermitted('evaluator', 'web:read')).toBe(false); expect(isPermitted('scout', 'web:read')).toBe(true);
  });
  it('prohibitions beat grants and unknown roles are denied', () => {
    expect(isPermitted('scout', 'web:post')).toBe(false); expect(isPermitted('nobody', 'task:read')).toBe(false);
  });
});

describe('PolicyEngine: five tiers ending in POL_DEFAULT_DENY (§4.3)', () => {
  it('tier 1: drafter network egress, audit modification and metadata IPs are hard denies', () => {
    expect(engine.evaluate(P('drafter'), 'web:read')).toMatchObject({ policy_id: 'POL_DRF_HARD_01', outcome: 'DENY', tier: 1 });
    expect(engine.evaluate(P('manager'), 'storage:audit_modify')).toMatchObject({ policy_id: 'POL_AUDIT_IMMUTABILITY', tier: 1 });
    expect(engine.evaluate(P('scout'), 'network:aws_imds')).toMatchObject({ policy_id: 'POL_SSRF_HARD_BLOCK', tier: 1 });
  });
  it('tier 1 also covers any employee whose network mode is none', () => {
    expect(engine.evaluate(P('strategist', { networkMode: 'none' }), 'web:read').policy_id).toBe('POL_DRF_HARD_01');
  });
  it('tier 2: funds and external submissions need approval', () => {
    expect(engine.evaluate(P('manager'), 'funds:commit')).toMatchObject({ outcome: 'REQUIRE_APPROVAL', tier: 2 });
    expect(engine.evaluate(P('manager'), 'external:submit_proposal')).toMatchObject({ policy_id: 'POL_EXT_SUBMISSION' });
  });
  it('tier 3: ambiguous score and budget breach escalate', () => {
    expect(engine.evaluate(P('evaluator'), 'evaluator:score_submit', { fit_score: 62 })).toMatchObject({ policy_id: 'POL_EVA_AMBIGUOUS_SCORE', tier: 3 });
    expect(engine.evaluate(P('manager'), 'model:invoke', { budget_breach: true }).policy_id).toBe('POL_BUDGET_CAP_BREACH');
  });
  it('tier 4: scout reads an approved domain with GET, RBAC grants, ABAC tenant denies', () => {
    expect(engine.evaluate(P('scout'), 'web:read', { url: 'https://www.ycombinator.com/rfs', method: 'GET' })).toMatchObject({ policy_id: 'POL_SCO_ALLOWLIST', outcome: 'ALLOW' });
    expect(engine.evaluate(P('context'), 'storage:vector_read').policy_id).toBe('POL_RBAC_GRANT');
    expect(engine.evaluate(P('context'), 'storage:vector_read', { tenant_id: 'other' }).policy_id).toBe('POL_ABAC_TENANT');
  });
  it('tier 5: anything not granted is POL_DEFAULT_DENY', () => {
    expect(engine.evaluate(P('scout'), 'payments:transfer')).toMatchObject({ policy_id: 'POL_DEFAULT_DENY', outcome: 'DENY', tier: 5 });
    expect(engine.evaluate(P('unknown'), 'task:read').policy_id).toBe('POL_DEFAULT_DENY');
  });
  it('enforce() throws the right exception per outcome', () => {
    expect(() => engine.enforce(P('drafter'), 'web:read')).toThrow(HardDenyViolationError);
    expect(() => engine.enforce(P('manager'), 'funds:commit')).toThrow(ApprovalRequiredError);
    expect(() => engine.enforce(P('manager'), 'model:invoke', { budget_breach: true })).toThrow(EscalationRequiredError);
    expect(() => engine.enforce(P('manager'), 'task:dispatch')).not.toThrow();
  });
});
