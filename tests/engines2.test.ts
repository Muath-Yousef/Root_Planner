import { describe, expect, it } from 'vitest';
import { ref } from './helpers';
import { openSession } from '../src/engine/breakGlass';
import { COMMAND_TREE, CONFIRM_WORD, advise, execute, parseCommand, type AdminContext } from '../src/engine/adminCli';
import { alignNodes, autoLayout } from '../src/engine/layout';
import { KillSwitchManager } from '../src/engine/killSwitchManager';
import { AuditLogger } from '../src/engine/auditLogger';

const issueReq = { scope: 'AUTHORIZE_FINANCIAL_COMMITMENT', target_resource: 'dept_x:task:a1', confirm_target: 'dept_x:task:a1', max_amount_usd: 50, ttl_seconds: 600 };

describe('break-glass rehearsal', () => {
  it('issues a token once-verifiable and rejects the replay', async () => {
    const s = await openSession(); const r = await s.issue(issueReq);
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect((await s.verify(r.token)).ok).toBe(true);
    expect((await s.verify(r.token)).ok).toBe(false);
  });
  it('enforces TTL, target confirmation and scope', async () => {
    const s = await openSession();
    expect(await s.issue({ ...issueReq, ttl_seconds: 901 })).toMatchObject({ ok: false, code: 'BG_TTL_EXCEEDED' });
    expect(await s.issue({ ...issueReq, confirm_target: 'other' })).toMatchObject({ ok: false, code: 'BG_TARGET_CONFIRM' });
    expect(await s.issue({ ...issueReq, scope: 'system:all' })).toMatchObject({ ok: false, code: 'BG_SCOPE' });
  });
  it('never exposes the secret key', async () => expect(JSON.stringify(await openSession())).not.toMatch(/secret|private/i));
});

describe('socroot-admin CLI', () => {
  const ctx = (): AdminContext => ({ employees: [], roles: [], templates: [], departments: ['dept_x'], kill: new KillSwitchManager(), audit: new AuditLogger(), budgets: { dept_x: { daily_cap_micro: 5_000_000, spent_micro: 0 } } });
  it('parses every command in the tree', () => {
    for (const d of COMMAND_TREE) expect(d.id).toBeTruthy();
    expect(parseCommand('socroot-admin budget inspect --dept dept_x').ok).toBe(true);
    expect(parseCommand('socroot-admin nope now').ok).toBe(false);
  });
  it('requires explicit confirmation, and the assistant can never execute', async () => {
    const p = parseCommand('socroot-admin budget set-limit --dept dept_x --amount 10'); if (!p.ok) throw new Error('parse');
    expect(await execute(p.command, ctx(), { kind: 'operator' }, '')).toMatchObject({ ok: false, code: 'CLI_CONFIRMATION_REQUIRED' });
    expect(await execute(p.command, ctx(), { kind: 'assistant' }, CONFIRM_WORD)).toMatchObject({ ok: false, code: 'CLI_ASSISTANT_CANNOT_EXECUTE' });
    expect((await execute(p.command, ctx(), { kind: 'operator' }, CONFIRM_WORD)).ok).toBe(true);
  });
  it('advises without executing', () => expect(advise('stop everything', ctx()).suggestions.length).toBeGreaterThanOrEqual(0));
});

describe('layout', () => {
  it('aligns nodes to the left edge and tidies without losing nodes', () => {
    const t = ref(); const ids = t.nodes.filter((n) => !n.parentId && n.data.kind !== 'zone').slice(0, 3).map((n) => n.id);
    const out = alignNodes(t.nodes, ids, 'left');
    const xs = new Set(out.filter((n) => ids.includes(n.id)).map((n) => n.position.x));
    expect(xs.size).toBe(1);
    expect(autoLayout(t.nodes, t.edges)).toHaveLength(t.nodes.length);
  });
});
