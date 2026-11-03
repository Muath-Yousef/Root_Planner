import { describe, expect, it } from 'vitest';
import { BudgetGuard } from '../src/engine/budgetGuard';
import { costMicro, microToUsd, usdToMicro, parsePricing } from '../src/engine/pricingCalculator';
import { PRICING_CONFIG_YAML, SOURCES_WATCHLIST_YAML } from '../src/presets/defaultConfigs';
import { parseWatchlist, validateRequest } from '../src/engine/ssrfGuard';
import { validateSecretRef, scanForSecrets } from '../src/engine/secretGuard';
import { KillSwitchManager } from '../src/engine/killSwitchManager';
import { NonceRegistry, generateSessionKeyPair, signToken, verifyToken } from '../src/engine/ed25519Verifier';
import { AuditLogger, TAMPER_MESSAGE } from '../src/engine/auditLogger';
import { decide } from '../src/engine/scoringEngine';

describe('pricing and BudgetGuard (§6.1, §6.7): micro-USD, six decimals', () => {
  it('converts exactly and prices tokens from the reference table', () => {
    expect(usdToMicro('0.1') + usdToMicro('0.2')).toBe(usdToMicro('0.3'));
    expect(microToUsd(usdToMicro('12.345678'))).toBe('12.345678');
    const t = parsePricing(PRICING_CONFIG_YAML);
    expect(Object.keys(t).length).toBeGreaterThan(0);
    const model = Object.keys(t)[0];
    expect(costMicro(t, model, 1_000_000, 0)).toBe(usdToMicro(t[model].input_per_million));
  });
  it('Reserve -> Commit -> Release -> Reconcile', () => {
    const g = new BudgetGuard(usdToMicro('0.30'), usdToMicro('1.00'));
    expect(g.reserve('t1', 'd', usdToMicro('0.20')).ok).toBe(true);
    expect(g.available('d')).toBe(usdToMicro('0.80'));
    expect(g.commit('t1', usdToMicro('0.123456')).ok).toBe(true);
    expect(g.available('d')).toBe(usdToMicro('0.876544'));
    g.reserve('t2', 'd', usdToMicro('0.10'));
    expect(g.release('t2').ok).toBe(true); expect(g.release('t2')).toMatchObject({ ok: false, error: 'NoReservation' });
    g.reserve('dead', 'd', usdToMicro('0.05'));
    expect(g.reconcile().released).toEqual(['dead']);
  });
  it('refuses above the task cap and above the department daily cap, and is idempotent per task', () => {
    const g = new BudgetGuard(usdToMicro('0.30'), usdToMicro('0.50'));
    expect(g.reserve('big', 'd', usdToMicro('0.31'))).toMatchObject({ ok: false, error: 'TaskBudgetExceededError' });
    g.reserve('a', 'd', usdToMicro('0.30'));
    expect(g.reserve('b', 'd', usdToMicro('0.25'))).toMatchObject({ ok: false, error: 'DepartmentBudgetExceededError' });
    expect(g.reserve('a', 'd', usdToMicro('0.30')).ok).toBe(true);
    expect(g.reserve('a', 'd', usdToMicro('0.10'))).toMatchObject({ ok: false, error: 'BudgetReservationConflict' });
  });
});

describe('SSRFGuard (§5.4.2) with the reference watchlist', () => {
  const cfg = parseWatchlist(SOURCES_WATCHLIST_YAML);
  const code = (u: string, m = 'GET', ips: string[] = []) => { const r = validateRequest(u, m, cfg, ips); return r.ok ? 'OK' : r.code; };
  it('allows approved domains and subdomains', () => { expect(code('https://www.ycombinator.com/rfs')).toBe('OK'); expect(code('https://ec.europa.eu/research/x')).toBe('OK'); });
  it('blocks methods, schemes and unapproved domains', () => {
    expect(code('https://www.ycombinator.com/rfs', 'POST')).toBe('SSRF_METHOD'); expect(code('ftp://ycombinator.com')).toBe('SSRF_SCHEME');
    expect(code('https://example.com/')).toBe('SSRF_DOMAIN_NOT_APPROVED'); expect(code('https://ycombinator.com.evil.com/')).toBe('SSRF_DOMAIN_NOT_APPROVED');
  });
  it.each(['https://127.0.0.1/', 'https://10.0.0.5/', 'https://169.254.169.254/latest/meta-data/', 'https://localhost/', 'https://[::1]/', 'https://192.168.1.1/'])('blocks internal target %s', (u) => expect(code(u)).toBe('SSRF_PRIVATE_IP'));
  it('blocks DNS rebinding: an approved host that resolves to a private or blocked address', () => {
    expect(code('https://ycombinator.com/rfs', 'GET', ['10.1.2.3'])).toBe('SSRF_PRIVATE_IP');
    expect(code('https://ycombinator.com/rfs', 'GET', ['93.184.216.34'])).toBe('OK');
  });
});

describe('SEC-001: secrets are vault:// references only', () => {
  it('rejects text that does not start with vault://', () => {
    expect(validateSecretRef('sk-live-abc123')).toMatchObject({ ok: false, code: 'SEC-001' });
    expect(validateSecretRef('https://x')).toMatchObject({ ok: false });
    expect(validateSecretRef('vault://depts/opp_acq/yc_api_key').ok).toBe(true);
  });
  it('finds pasted secrets in free text', () => expect(scanForSecrets('key = "AKIAABCDEFGHIJKLMNOP"').length).toBe(1));
});

describe('KillSwitchManager (§4.4)', () => {
  it('engages instantly; TASK expires after 24h; DEPARTMENT release needs a human', () => {
    let now = 0; const k = new KillSwitchManager(() => now);
    k.engage('TASK', 't1', 'op', 'drill'); k.engage('DEPARTMENT', 'dept_x', 'op', 'drill');
    expect(k.halted({ task_id: 't1' })).toBeDefined();
    expect(k.release('DEPARTMENT', 'dept_x', 'drill finished ok')).toMatchObject({ ok: false, code: 'KILL_HUMAN_REQUIRED' });
    expect(k.release('DEPARTMENT', 'dept_x', 'drill finished ok', true).ok).toBe(true);
    now = 86_401_000; expect(k.halted({ task_id: 't1' })).toBeUndefined();
  });
  it('GLOBAL halts everything', () => { const k = new KillSwitchManager(); k.engage('GLOBAL', '', 'op', 'x'); expect(k.halted({ employee_id: 'anyone' })).toBeDefined(); });
});

describe('Ed25519 founder token (§4.5.2): 15 minute TTL and nonce replay defense', () => {
  it('verifies once, then rejects the replayed nonce', async () => {
    const key = await generateSessionKeyPair(); const nonces = new NonceRegistry();
    const tok = await signToken({ scope: 'AUTHORIZE_FINANCIAL_COMMITMENT', target_resource: 'dept:task:1', max_amount_usd: 500, ttl_seconds: 600 }, key);
    expect((await verifyToken(tok, nonces, { scope: 'AUTHORIZE_FINANCIAL_COMMITMENT' })).ok).toBe(true);
    expect(await verifyToken(tok, nonces)).toMatchObject({ ok: false, code: 'TOKEN_REPLAY' });
  });
  it('rejects a TTL above 15 minutes, an expired token and a tampered one', async () => {
    const key = await generateSessionKeyPair();
    const long = await signToken({ scope: 's', target_resource: 't', max_amount_usd: 1, ttl_seconds: 901 }, key);
    expect(await verifyToken(long, new NonceRegistry())).toMatchObject({ code: 'TOKEN_TTL_EXCEEDED' });
    const old = await signToken({ scope: 's', target_resource: 't', max_amount_usd: 1, ttl_seconds: 60, now: Date.now() - 3_600_000 }, key);
    expect(await verifyToken(old, new NonceRegistry())).toMatchObject({ code: 'TOKEN_EXPIRED' });
    const ok = await signToken({ scope: 's', target_resource: 't', max_amount_usd: 1, ttl_seconds: 60 }, key);
    expect(await verifyToken({ ...ok, max_amount_usd: 999 }, new NonceRegistry())).toMatchObject({ code: 'TOKEN_BAD_SIGNATURE' });
  });
});

describe('AuditLogger SHA-256 chain (§5.3.8) and tamper detection', () => {
  it('verifies an intact chain and reports SECURITY VIOLATION [AUDIT_TAMPER_ATTEMPT] after a change', async () => {
    const a = new AuditLogger(); await a.record('t', 'e', 'A', { x: 1 }); await a.record('t', 'e', 'B', { y: 2 });
    expect(a.records[0].prev_hash).toBe('GENESIS');
    expect((await a.verify()).ok).toBe(true);
    a.records[0].event_type = 'x';
    const r = await a.verify();
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.message).toContain(TAMPER_MESSAGE); expect(r.violations.map((v) => v.type)).toContain('ENTRY_HASH_MISMATCH'); }
  });
});

describe('scoringEngine thresholds (§3.3.1)', () => {
  it.each([[88, 'FAST_TRACK'], [85, 'FAST_TRACK'], [75, 'PROCEED'], [70, 'PROCEED'], [62, 'ESCALATE'], [50, 'ESCALATE'], [45, 'ESCALATE'], [40, 'ESCALATE'], [39.9, 'ABORT'], [30, 'ABORT']])('score %s -> %s', (s, d) => expect(decide(s).decision).toBe(d));
  it('flags the unspecified 40-49.9 band instead of hiding it', () => expect(decide(45).policy).toBe('POL_EVA_UNSPECIFIED_BAND'));
});
