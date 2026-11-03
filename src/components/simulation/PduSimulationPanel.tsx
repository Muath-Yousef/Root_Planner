import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { AuditLogger } from '../../engine/auditLogger';
import { decide, calculateFitScore } from '../../engine/scoringEngine';
import { parsePricing, costUsd } from '../../engine/pricingCalculator';
import { initialPlayer, isFinished, playerReducer } from '../../engine/simPlayer';
import { runSimulation, type SimResult, type StepStatus } from '../../engine/simulationRunner';
import { parseWatchlist } from '../../engine/ssrfGuard';
import { FAULT_IDS, SCENARIOS, type FaultId, type SimFaults } from '../../registry/scenarios';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/en';
import { AuditChainViewer } from './AuditChainViewer';

const TONE: Record<StepStatus, string> = {
  ok: 'border-emerald-500',
  warning: 'border-amber-400',
  blocked: 'border-rose-500',
  info: 'border-sky-500',
};
const FAULT_KEY: Record<FaultId, MessageKey> = {
  failover: 'sim.fault.failover',
  budget: 'sim.fault.budget',
  ssrf: 'sim.fault.ssrf',
  duplicate: 'sim.fault.duplicate',
};
const STATUS_KEY: Record<StepStatus, MessageKey> = {
  ok: 'sim.status.ok',
  warning: 'sim.status.warning',
  blocked: 'sim.status.blocked',
  info: 'sim.status.info',
};

const DEFAULT_REQUIREMENTS = [
  'mandatory_criteria_satisfied',
  'market_opportunity_size',
  'technical_feasibility',
  'timeline_compatibility',
];
const DEFAULT_WEIGHTS: Record<string, number> = {
  mandatory_criteria_satisfied: 2.0,
  market_opportunity_size: 1.5,
  technical_feasibility: 1.5,
  timeline_compatibility: 1.0,
};

export function PduSimulationPanel() {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const tenant = useStudio((s) => s.tenant_id);
  const watchlist = useStudio((s) => s.configs.sources_watchlist);
  const pricingConfig = useStudio((s) => s.configs.pricing_config);
  const edges = useStudio((s) => s.edges);
  const setActiveActorNodeId = useStudio((s) => s.setActiveActorNodeId);
  const setActivePulsingCableId = useStudio((s) => s.setActivePulsingCableId);

  const ssrf = useMemo(() => parseWatchlist(watchlist), [watchlist]);
  const pricingTable = useMemo(() => parsePricing(pricingConfig), [pricingConfig]);

  const [useRubric, setUseRubric] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [criteria, setCriteria] = useState<Record<string, number>>({
    mandatory_criteria_satisfied: 95,
    market_opportunity_size: 85,
    technical_feasibility: 90,
    timeline_compatibility: 80,
  });

  const computedRubricScore = useMemo(() => {
    return calculateFitScore(criteria, DEFAULT_REQUIREMENTS, DEFAULT_WEIGHTS);
  }, [criteria]);

  const [sliderScore, setSliderScore] = useState(88);
  const score = useRubric ? computedRubricScore : sliderScore;

  const [faults, setFaults] = useState<Partial<SimFaults>>({});
  const [run, setRun] = useState<SimResult | null>(null);
  const [player, dispatch] = useReducer(playerReducer, initialPlayer);
  const [chain, setChain] = useState<{ ok: boolean; text: string } | null>(null);

  const start = useCallback(
    async (fit: number, f: Partial<SimFaults>, autoplay: boolean) => {
      const r = await runSimulation({ fit_score: fit, faults: f, ssrf, tenant_id: tenant });
      if (typeof window === 'undefined') return;
      setRun({ ...r, audit: r.audit.map((a) => ({ ...a })) });
      setChain(null);
      dispatch({ type: 'load', total: r.steps.length });
      if (autoplay) dispatch({ type: 'play' });
    },
    [ssrf, tenant]
  );

  useEffect(() => {
    if (!player.playing) return;
    const interval = Math.round(900 / speed);
    const id = setInterval(() => dispatch({ type: 'tick' }), interval);
    return () => clearInterval(id);
  }, [player.playing, speed]);

  const shown = run?.steps.slice(0, player.revealed) ?? [];
  const records = run?.audit.slice(0, player.revealed) ?? [];
  const currentStep = shown.length > 0 ? shown[shown.length - 1] : null;

  // Space / Arrow keys keyboard navigation for simulation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: player.playing ? 'stop' : 'play' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatch({ type: 'step_back' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        dispatch({ type: 'step' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player.playing]);

  // Canvas Synchronisation: Active actor highlight and pulsing cable
  useEffect(() => {
    if (currentStep) {
      setActiveActorNodeId(currentStep.actor);
      const cable = edges.find(
        (e) =>
          e.source.includes(currentStep.actor) ||
          e.target.includes(currentStep.actor) ||
          (currentStep.step_number === 1 && e.data?.kind === 'TASK_DISPATCH_RESULT') ||
          (currentStep.step_number === 7 && e.data?.kind === 'ESCALATION_PATH') ||
          ((currentStep.id === 'MODEL_FAILOVER' || currentStep.id === 'MODEL_INVOKE' || currentStep.id === 'EVALUATOR_DECISION') &&
            e.data?.kind === 'MEMORY_BUS')
      );
      setActivePulsingCableId(cable ? cable.id : null);
    } else {
      setActiveActorNodeId(null);
      setActivePulsingCableId(null);
    }
  }, [currentStep, edges, setActiveActorNodeId, setActivePulsingCableId]);

  // Clean up when unmounting or finished
  useEffect(() => {
    return () => {
      setActiveActorNodeId(null);
      setActivePulsingCableId(null);
    };
  }, [setActiveActorNodeId, setActivePulsingCableId]);

  const d = decide(score);

  const verify = async () => {
    const l = new AuditLogger();
    l.records = records;
    const r = await l.verify();
    setChain(r.ok ? { ok: true, text: tr('sim.chain.ok', { n: r.length }) } : { ok: false, text: r.message });
  };

  const tamper = () => {
    if (run?.audit[0]) {
      run.audit[0].event_type = 'tampered';
      setRun({ ...run });
    }
  };

  // Steps 4+5 Model Pricing calculation demonstration
  const step5EstimatedCost = useMemo(() => {
    try {
      return costUsd(pricingTable, 'claude-3-7-sonnet-20250219', 2450, 890);
    } catch {
      return 0.0207;
    }
  }, [pricingTable]);

  const btn = 'rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400';

  return (
    <section className="space-y-3" aria-label={tr('sim.title')}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="font-semibold text-slate-100">{tr('sim.title')}</h2>
        <span className="font-mono text-[10px] text-sky-400">§3.1.3 · 9-Step Loop</span>
      </div>

      {/* Preset Scenarios */}
      <div>
        <div className="mb-1 text-xs text-slate-400">{tr('sim.scenarios')}</div>
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setUseRubric(false);
                setSliderScore(s.fit_score);
                setFaults(s.faults);
                void start(s.fit_score, s.faults, true);
              }}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {s.label[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Fit Score & Interactive Criteria Rubric (§3.3.1 & §3.3.2) */}
      <div className="rounded border border-slate-800 bg-slate-950 p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>
            {tr('sim.score')}: <b dir="ltr" className="text-sky-400">{score.toFixed(1)}</b> →{' '}
            <b dir="ltr" className={score >= 70 ? 'text-emerald-400' : 'text-rose-400'}>{d.decision}</b>{' '}
            <span className="text-slate-400" dir="ltr">({d.band})</span>
          </span>
          <button
            onClick={() => setUseRubric(!useRubric)}
            className="text-[10px] text-sky-400 hover:underline font-mono"
          >
            {useRubric ? tr('sim.rubric.slider') : tr('sim.rubric.formula')}
          </button>
        </div>

        {useRubric ? (
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="text-[10px] font-mono text-slate-400 mb-1">
              §3.3.2 · calculateFitScore: Σ(weight × satisfaction) / Σ(weights)
            </div>
            {DEFAULT_REQUIREMENTS.map((req) => (
              <div key={req} className="space-y-0.5">
                <div className="flex justify-between text-slate-300">
                  <span className="font-mono text-[10px]">{req} (×{DEFAULT_WEIGHTS[req]})</span>
                  <span className="font-mono text-sky-300">{criteria[req]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={criteria[req]}
                  onChange={(e) => setCriteria({ ...criteria, [req]: +e.target.value })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        ) : (
          <input
            type="range"
            min={0}
            max={100}
            value={sliderScore}
            onChange={(e) => setSliderScore(+e.target.value)}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        )}
      </div>

      {d.note && <p className="text-xs text-amber-400">{d.note}</p>}

      {/* Fault Injections */}
      <fieldset className="rounded border border-slate-800 bg-slate-950 p-2 text-xs">
        <legend className="px-1 text-[11px] text-slate-400">{tr('sim.faults')}</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {FAULT_IDS.map((f) => (
            <label key={f} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={!!faults[f]}
                onChange={(e) => setFaults({ ...faults, [f]: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800"
              />
              <span className="truncate">{tr(FAULT_KEY[f])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Playback Controls & Speed Selector */}
      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => dispatch({ type: 'step_back' })}
              disabled={player.revealed === 0}
              className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
              title={tr('sim.step_back')}
            >
              ⏮
            </button>
            <button
              onClick={() => void start(score, faults, true)}
              className={`${btn} bg-sky-600 text-white hover:bg-sky-500 font-bold`}
            >
              ▶ {tr('sim.run')}
            </button>
            <button
              onClick={async () => {
                if (!run) await start(score, faults, false);
                dispatch({ type: 'step' });
              }}
              disabled={isFinished(player)}
              className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
              title={tr('sim.step')}
            >
              ⏭
            </button>
            <button
              onClick={() => dispatch({ type: 'stop' })}
              disabled={!player.playing}
              className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
              title={tr('sim.stop')}
            >
              ⏸
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'reset' });
                setChain(null);
                setActiveActorNodeId(null);
                setActivePulsingCableId(null);
              }}
              disabled={!run}
              className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
              title={tr('sim.reset')}
            >
              ↺
            </button>
          </div>

          {/* Speed 0.5x / 1x / 2x */}
          <div className="flex items-center gap-1 text-[11px]">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono ${
                  speed === s ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Scrubbable Timeline */}
        {run && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{tr('sim.timeline')}</span>
              <span>
                {player.revealed} / {player.total}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={player.total}
              value={player.revealed}
              onChange={(e) => dispatch({ type: 'seek', revealed: +e.target.value })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
        )}
      </div>

      {/* Current Step Explanation Pinned Box */}
      {currentStep && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3 space-y-1 shadow-lg backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs font-bold text-sky-300">
            <span>📌 {tr('sim.current_step')}</span>
            <span className="font-mono text-[10px] text-sky-400">
              §3.1.3 · Step {currentStep.step_number}
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed" dir="auto">
            <b>{currentStep.title[lang]}:</b> {currentStep.why[lang]}
          </p>
        </div>
      )}

      {run && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{tr('sim.progress', { n: player.revealed, total: player.total })}</span>
          <span className="font-mono text-[10px] text-emerald-400">
            {tr('sim.cost.steps4_5', { cost: step5EstimatedCost.toFixed(4) })}
          </span>
        </div>
      )}
      {!run && <p className="text-xs text-slate-400">{tr('sim.empty')}</p>}

      {/* Steps List */}
      <ol className="space-y-2">
        {shown.map((s) => (
          <li key={s.index} className={`rounded-lg border-s-4 bg-slate-800/60 p-2.5 text-xs shadow-xs ${TONE[s.status]}`}>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-sky-400">
                §3.1.3 · {s.step_number === '4+5' ? tr('sim.step.4_5') : tr('sim.step.single', { n: s.step_number })}
              </span>
              <b className="text-slate-100 truncate">{s.title[lang]}</b>
              <span className="ms-auto text-slate-400 text-[10px]">{tr(STATUS_KEY[s.status])}</span>
            </div>
            <div className="text-slate-400 mt-1 font-mono text-[10px]" dir="ltr">
              <span className="text-cyan-300 font-semibold">{s.actor}</span>
              {s.policy_id ? ` · ${s.policy_id}` : ''}
            </div>
            <p className="mt-1 text-slate-300 leading-relaxed">
              <b>{tr('sim.why')}</b> {s.why[lang]}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 text-[10px]">
                {tr('sim.payload')}
              </summary>
              <pre dir="ltr" className="overflow-x-auto text-[10px] bg-slate-950 p-1.5 rounded mt-1 font-mono text-slate-300">
                {JSON.stringify(s.payload, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ol>

      {/* Result Card at the end of simulation */}
      {run && isFinished(player) && (
        <div className="rounded-xl border border-sky-600 bg-slate-900 p-4 space-y-2.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-xs text-sky-300 flex items-center gap-1.5">
              <span>🏆</span>
              <span>{tr('sim.card.title')}</span>
            </h3>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                run.outcome === 'FAST_TRACK' || run.outcome === 'PROCEED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {run.outcome}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-950 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{tr('sim.card.decision')}</span>
              <b dir="ltr" className="text-sky-300 font-mono text-xs">{d.decision}</b>
            </div>
            <div className="rounded bg-slate-950 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{tr('sim.card.cost')}</span>
              <b dir="ltr" className="text-emerald-400 font-mono text-xs">${step5EstimatedCost.toFixed(4)}</b>
            </div>
          </div>

          <div className="rounded bg-slate-950 p-2 border border-slate-800 text-[10px] font-mono space-y-0.5">
            <span className="text-slate-400 block">{tr('sim.card.audit_hash')}</span>
            <span dir="ltr" className="text-cyan-300 truncate block">
              {records[records.length - 1]?.entry_hash ?? 'sha256:4f8a91b...'}
            </span>
          </div>

          <button
            onClick={verify}
            className="w-full rounded bg-sky-600 py-1.5 text-xs font-bold text-white hover:bg-sky-500 shadow-md shadow-sky-950 transition-colors"
          >
            🛡️ {tr('sim.card.view_chain')}
          </button>
        </div>
      )}

      {/* Audit Chain Verification */}
      <AuditChainViewer records={records} status={chain} onVerify={verify} onTamper={tamper} />
    </section>
  );
}
