import { describe, expect, it } from 'vitest';
import { runSimulation } from '../src/engine/simulationRunner';
import { parseWatchlist } from '../src/engine/ssrfGuard';
import { SOURCES_WATCHLIST_YAML } from '../src/presets/defaultConfigs';
import { SCENARIOS } from '../src/registry/scenarios';
import { TAMPER_CODE } from '../src/engine/auditLogger';

const ssrf = parseWatchlist(SOURCES_WATCHLIST_YAML);
const run = (fit_score: number, faults = {}) => runSimulation({ fit_score, faults, ssrf });
const ids = (r: Awaited<ReturnType<typeof run>>) => r.steps.map((s) => s.id);

describe('simulationRunner', () => {
  it('fit 88 / 62 / 30 end as FAST_TRACK / ESCALATE / ABORT', async () => {
    expect((await run(88)).outcome).toBe('FAST_TRACK'); expect((await run(62)).outcome).toBe('ESCALATE'); expect((await run(30)).outcome).toBe('ABORT');
    expect((await run(75)).outcome).toBe('PROCEED');
  });
  it('FAST_TRACK skips the strategist, PROCEED goes through it, ESCALATE ends with a package, ABORT with a report', async () => {
    expect((await run(88)).steps.some((s) => s.actor.includes('strategist'))).toBe(false);
    expect((await run(75)).steps.some((s) => s.actor.includes('strategist'))).toBe(true);
    expect(ids(await run(62))).toContain('ESCALATION_PACKAGE');

    const abortRun = await run(30);
    expect(ids(abortRun)).toContain('ABORT_REPORT');
    const abortStepNums = abortRun.steps.map((s) => s.step_number);
    expect(abortStepNums).not.toContain(6);
    expect(abortStepNums).not.toContain(7);
    expect(abortStepNums).not.toContain(8);
    expect(abortStepNums).not.toContain(9);
    const lastStep = abortRun.steps.at(-1)!;
    expect(lastStep.id).toBe('ABORT_REPORT');
    expect(lastStep.title.en).toContain('4+5');
    expect(lastStep.title.ar).toContain('4+5');
  });
  it('the unspecified 40–49.9 band escalates with its own policy id (G-05)', async () => {
    const r = await run(45); expect(r.outcome).toBe('ESCALATE'); expect(r.steps.find((s) => s.id === 'EVALUATOR_DECISION')?.policy_id).toBe('POL_EVA_UNSPECIFIED_BAND');
  });
  it('every step explains itself in both languages and is audited with an intact chain', async () => {
    const r = await run(88);
    for (const s of r.steps) { expect(s.why.en.length).toBeGreaterThan(10); expect(s.why.ar.length).toBeGreaterThan(10); }
    expect(r.audit).toHaveLength(r.steps.length); expect(r.chain.ok).toBe(true);
    // Verifies §3.1.3 loop: [1, 2, 3, '4+5', 6, 8, 9] with no separate 4 or 5 and 6 for TASK_RESULT only
    const distinctStepNums = Array.from(new Set(r.steps.map((s) => s.step_number)));
    expect(distinctStepNums).toEqual([1, 2, 3, '4+5', 6, 8, 9]);
    expect(r.steps.filter((s) => s.step_number === 6).map((s) => s.id)).toEqual(['TASK_RESULT']);
  });
  it('SSRF fault: the metadata address is blocked and logged, the task goes on', async () => {
    const r = await run(88, { ssrf: true }); const s = r.steps.find((x) => x.id === 'SCOUT_FETCH')!;
    expect(s.status).toBe('blocked'); expect(s.policy_id).toBe('POL_SSRF_HARD_BLOCK'); expect(s.payload.ssrf_code).toBe('SSRF_PRIVATE_IP'); expect(r.outcome).toBe('FAST_TRACK');
  });
  it('budget fault: refused before any model call, escalated, nothing spent', async () => {
    const r = await run(88, { budget: true });
    expect(r.outcome).toBe('ESCALATE'); expect(ids(r)).not.toContain('MODEL_INVOKE');
    expect(r.steps.find((s) => s.id === 'BUDGET_RESERVE')).toMatchObject({ status: 'blocked', policy_id: 'POL_BUDGET_CAP_BREACH' });
    expect(r.steps.at(-1)?.payload.spent_usd).toBe('0.000000');
  });
  it('failover fault adds a visible retry and the task still finishes', async () => {
    const r = await run(88, { failover: true }); expect(ids(r)).toContain('MODEL_FAILOVER'); expect(r.outcome).toBe('FAST_TRACK');
  });
  it('duplicate fault: second delivery is dropped, one model call only', async () => {
    const r = await run(88, { duplicate: true });
    expect(r.steps.find((s) => s.id === 'DUPLICATE_DROPPED')?.status).toBe('blocked'); expect(ids(r).filter((i) => i === 'MODEL_INVOKE')).toHaveLength(1);
  });
  it('every scenario in the registry runs', async () => {
    for (const sc of SCENARIOS) expect((await run(sc.fit_score, sc.faults)).steps.length).toBeGreaterThan(3);
  });
  it('tampering with a recorded step is detected', async () => {
    const r = await run(88); (r.audit[2] as { event_type: string }).event_type = 'tampered';
    const { AuditLogger } = await import('../src/engine/auditLogger'); const l = new AuditLogger(); l.records = r.audit;
    const v = await l.verify(); expect(v.ok).toBe(false); if (!v.ok) expect(v.code).toBe(TAMPER_CODE);
  });
  it('is deterministic for a given task id and clock', async () => {
    const a = await run(88); const b = await runSimulation({ fit_score: 88, ssrf, task_id: a.task_id });
    expect(b.steps.map((s) => s.id)).toEqual(a.steps.map((s) => s.id));
  });
});
