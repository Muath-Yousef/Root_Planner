import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { SNode, MachineId, NetworkMode } from '../../../types';
import { canTransition, promotionReady } from '../../../types';
import {
  setIdentity,
  setNetworkMode,
  transition,
  runSyntheticBenchmark,
  setShadowMatch,
  setScorecard,
} from '../../../engine/inspectorEdit';
import { useStudio } from '../../../store/useStudioStore';
import { useT } from '../../../i18n/useT';

interface IdentityTabProps {
  node: SNode;
}

const LIFECYCLE_STATES = ['DRAFT', 'VALIDATED', 'BENCHMARKED', 'CERTIFIED', 'DEPRECATED'] as const;
const DEPLOYMENT_STATES = ['STOPPED', 'PROVISIONING', 'RUNNING', 'HEALTHY', 'DEGRADED', 'FROZEN'] as const;
const AUTONOMY_STATES = ['L1_SHADOW', 'L2_ASSISTED', 'L3_LIMITED_AUTONOMOUS', 'L4_AUTONOMOUS', 'L5_FOUNDER_DELEGATE'] as const;

export function IdentityTab({ node }: IdentityTabProps) {
  const tr = useT();
  const applyEdit = useStudio((s) => s.applyEdit);
  const updateNodeDimensions = useStudio((s) => s.updateNodeDimensions);
  const emp = node.data.employee;
  const contract = emp?.contract as Record<string, unknown> | undefined;

  const [name, setName] = useState<string>(String(contract?.name ?? node.data.label ?? ''));
  const [mission, setMission] = useState<string>(String(contract?.mission ?? ''));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!emp) {
    if (node.data.kind === 'zone') {
      const currentW = Math.round(typeof node.style?.width === 'number' ? node.style.width : (node.width ?? 360));
      const currentH = Math.round(typeof node.style?.height === 'number' ? node.style.height : (node.height ?? 240));

      return (
        <div className="space-y-5 text-sm text-slate-300">
          <div>
            <label className="block text-xs font-medium text-slate-400">Node Label</label>
            <div className="mt-1 font-semibold text-slate-100">{node.data.label}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Role / Kind</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sky-400">{node.data.role}</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {node.data.zone?.zone ?? 'line'}
              </span>
              {node.data.zone?.isolation && (
                <span className="rounded bg-amber-950/70 border border-amber-600/40 px-1.5 py-0.5 text-xs text-amber-300">
                  {node.data.zone.isolation}
                </span>
              )}
            </div>
          </div>

          {/* Dedicated Zone Dimensions Section */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Maximize2 className="h-4 w-4 text-sky-400" />
                <span>{tr('zone.dimensions')}</span>
              </div>
              <span className="font-mono text-xs text-sky-400 bg-sky-950/60 border border-sky-600/40 px-2 py-0.5 rounded" dir="ltr">
                {currentW} × {currentH} px
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3" dir="ltr">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('zone.width')}</label>
                <input
                  type="number"
                  min={180}
                  step={20}
                  value={currentW}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 100) updateNodeDimensions(node.id, val, currentH);
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-mono text-slate-100 focus:border-sky-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('zone.height')}</label>
                <input
                  type="number"
                  min={100}
                  step={20}
                  value={currentH}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 60) updateNodeDimensions(node.id, currentW, val);
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-mono text-slate-100 focus:border-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs text-slate-400 mb-2">{tr('zone.presets')}</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => updateNodeDimensions(node.id, 360, 240)}
                  className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  360 × 240 (Small)
                </button>
                <button
                  type="button"
                  onClick={() => updateNodeDimensions(node.id, 640, 420)}
                  className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  640 × 420 (Medium)
                </button>
                <button
                  type="button"
                  onClick={() => updateNodeDimensions(node.id, 1100, 700)}
                  className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  1100 × 700 (Large)
                </button>
                <button
                  type="button"
                  onClick={() => updateNodeDimensions(node.id, 1600, 900)}
                  className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  1600 × 900 (Dept)
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400/90 leading-relaxed border-t border-slate-700/60 pt-2.5">
              💡 {tr('zone.resizeHint')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm text-slate-300">
        <div>
          <label className="block text-xs font-medium text-slate-400">Node Label</label>
          <div className="mt-1 font-semibold text-slate-100">{node.data.label}</div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400">Role / Kind</label>
          <div className="mt-1 text-slate-200">{node.data.role} ({node.data.kind})</div>
        </div>
      </div>
    );
  }

  const handleSaveIdentity = () => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => setIdentity(n, tid, { name, mission }));
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  const handleNetworkChange = (mode: NetworkMode) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => setNetworkMode(n, tid, mode));
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  const handleTransition = (machine: MachineId, to: string) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => transition(n, tid, machine, to));
    if (!res.ok) {
      setErrorMsg(`[${res.code}] ${res.message}`);
    }
  };

  const handleSyntheticBenchmark = () => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => runSyntheticBenchmark(n, tid));
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  const handleShadowChange = (val: number) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => setShadowMatch(n, tid, val));
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  const handleScorecardChange = (key: string, val: number) => {
    setErrorMsg(null);
    const res = applyEdit(node.id, (n, tid) => setScorecard(n, tid, key, val));
    if (!res.ok) {
      setErrorMsg(res.message);
    }
  };

  const currentNetwork = (contract?.runtime_config as { docker_network?: NetworkMode } | undefined)?.docker_network ?? emp.contract ? node.data.networkMode ?? 'internal' : 'internal';
  const promoReady = promotionReady(emp.promotion);

  return (
    <div className="space-y-5 text-sm">
      {errorMsg && (
        <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Identity Fields */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {tr('inspector.name')} & {tr('inspector.mission')}
        </h3>
        <div>
          <label className="text-xs text-slate-400">{tr('inspector.name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">{tr('inspector.mission')}</label>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSaveIdentity}
          className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500"
        >
          {tr('inspector.save')}
        </button>
      </section>

      {/* Network Mode */}
      <section className="space-y-2 rounded border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {tr('inspector.network')}
        </h3>
        <div className="flex gap-2">
          {(['none', 'internal', 'isolated'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleNetworkChange(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                currentNetwork === m ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* State Machines (LIF-001) */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {tr('inspector.machines')}
        </h3>

        {/* Lifecycle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{tr('inspector.machine.lifecycle')}:</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-sky-400">
              {emp.lifecycle}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {LIFECYCLE_STATES.map((st) => {
              const allowed = canTransition('lifecycle', emp.lifecycle, st);
              const isCurrent = emp.lifecycle === st;
              return (
                <button
                  key={st}
                  disabled={!allowed && !isCurrent}
                  onClick={() => handleTransition('lifecycle', st)}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    isCurrent
                      ? 'bg-sky-600 text-white font-semibold'
                      : allowed
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Deployment */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{tr('inspector.machine.deployment')}:</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-emerald-400">
              {emp.deployment}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {DEPLOYMENT_STATES.map((st) => {
              const allowed = canTransition('deployment', emp.deployment, st);
              const isCurrent = emp.deployment === st;
              return (
                <button
                  key={st}
                  disabled={!allowed && !isCurrent}
                  onClick={() => handleTransition('deployment', st)}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    isCurrent
                      ? 'bg-emerald-600 text-white font-semibold'
                      : allowed
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Autonomy */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{tr('inspector.machine.autonomy')}:</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-amber-400">
              {emp.autonomy}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {AUTONOMY_STATES.map((st) => {
              const allowed = canTransition('autonomy', emp.autonomy, st);
              const isCurrent = emp.autonomy === st;
              return (
                <button
                  key={st}
                  disabled={!allowed && !isCurrent}
                  onClick={() => handleTransition('autonomy', st)}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    isCurrent
                      ? 'bg-amber-600 text-white font-semibold'
                      : allowed
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Promotion Scorecard (EVA-001) */}
      <section className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr('inspector.promotion')}
          </h3>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              promoReady ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {promoReady ? 'PROMOTION READY' : 'INCOMPLETE'}
          </span>
        </div>

        {/* Synthetic benchmark */}
        <div className="flex items-center justify-between text-xs">
          <div>
            <div className="text-slate-300">Phase 1: Synthetic Benchmark</div>
            <div className="text-[11px] text-slate-400">Passed: {emp.promotion.synthetic_passed} / 20</div>
          </div>
          <button
            onClick={handleSyntheticBenchmark}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-sky-400 hover:bg-slate-700"
          >
            {tr('inspector.synthetic')}
          </button>
        </div>

        {/* Shadow match rate */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-300">Phase 2: Shadow Match Rate (min 0.95):</span>
            <span className="font-mono text-slate-200">{(emp.promotion.shadow_match_rate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={emp.promotion.shadow_match_rate}
            onChange={(e) => handleShadowChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Scorecard metrics */}
        {Object.keys(emp.promotion.scorecard).length > 0 && (
          <div className="space-y-2 border-t border-slate-800 pt-2 text-xs">
            <div className="text-[11px] font-medium text-slate-400">{tr('inspector.scorecard')}:</div>
            {Object.entries(emp.promotion.scorecard).map(([metric, val]) => (
              <div key={metric} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300 font-mono">{metric}</span>
                  <span className="font-mono text-slate-400">{(val * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={val}
                  onChange={(e) => handleScorecardChange(metric, parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
