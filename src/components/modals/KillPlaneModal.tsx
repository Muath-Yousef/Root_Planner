import { useState } from 'react';
import { useStudio } from '../../store/useStudioStore';
import type { KillLevel } from '../../engine/killSwitchManager';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';
import { ConfirmDialog } from '../common/ConfirmDialog';

const LEVELS: KillLevel[] = ['TASK', 'EMPLOYEE', 'DEPARTMENT', 'GLOBAL'];

export function KillPlaneModal() {
  const tr = useT();
  const killModalOpen = useStudio((s) => s.killModalOpen);
  const setKillModalOpen = useStudio((s) => s.setKillModalOpen);
  const killSwitch = useStudio((s) => s.killSwitch);
  const notify = useStudio((s) => s.notify);
  const nodes = useStudio((s) => s.nodes);

  const [level, setLevel] = useState<KillLevel>('EMPLOYEE');
  const [target, setTarget] = useState('opp_acq.evaluator.v1');
  const [reason, setReason] = useState('Emergency halt from operator kill plane');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmingEngage, setConfirmingEngage] = useState(false);
  const [, setTick] = useState(0);

  const dialogRef = useModalA11y<HTMLDivElement>(killModalOpen, () => setKillModalOpen(false));

  if (!killModalOpen) return null;

  const records = killSwitch.records();

  const executeEngage = () => {
    setMsg(null);
    setConfirmingEngage(false);
    const tgt = level === 'GLOBAL' ? '*' : target;
    const res = killSwitch.engage(level, tgt, 'operator', reason);
    if (!res.ok) {
      setMsg({ text: `[${res.code}] ${res.reason}`, ok: false });
      notify('error', `[${res.code}] ${res.reason}`);
    } else {
      const successText = `Engaged ${level} kill switch on ${tgt}`;
      setMsg({ text: successText, ok: true });
      notify('error', successText);
      setTick((t) => t + 1);
    }
  };

  const handleEngage = () => {
    setConfirmingEngage(true);
  };

  const handleRelease = (lvl: KillLevel, tgt: string) => {
    setMsg(null);
    const res = killSwitch.release(lvl, tgt, reason || 'Released by authorized operator', true);
    if (!res.ok) {
      setMsg({ text: `[${res.code}] ${res.reason}`, ok: false });
    } else {
      setMsg({ text: `Released ${lvl} kill switch on ${tgt}`, ok: true });
      setTick((t) => t + 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kill-plane-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-xl border border-rose-700/60 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-900/60 bg-rose-950/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
            <div>
              <div className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                {tr('kill.title')}
              </div>
              <h2 id="kill-plane-modal-title" className="text-sm font-bold text-slate-100">
                Independent Hardware / OS Signal Kill Plane (REL-001)
              </h2>
            </div>
          </div>
          <button
            onClick={() => setKillModalOpen(false)}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          <p className="text-slate-400">
            REL-001: The Kill Plane is strictly isolated from the application and LLM planes. Commands here bypass application logic,
            streaming Redis pub/sub and issuing OS SIGTERM signals directly.
          </p>

          {msg && (
            <div
              className={`rounded p-2 text-xs border ${
                msg.ok ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300' : 'border-rose-800 bg-rose-950/50 text-rose-300'
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Form */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 font-medium">{tr('kill.level')}</label>
                <select
                  value={level}
                  onChange={(e) => {
                    const l = e.target.value as KillLevel;
                    setLevel(l);
                    if (l === 'GLOBAL') setTarget('*');
                    else if (l === 'DEPARTMENT') setTarget('dept_opportunity_acquisition');
                    else setTarget('opp_acq.evaluator.v1');
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 font-mono text-xs"
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium">{tr('kill.target')}</label>
                <input
                  disabled={level === 'GLOBAL'}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-100 disabled:opacity-40"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-medium">{tr('kill.reason')}</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for audit and release logging"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100"
              />
            </div>

            <button
              onClick={handleEngage}
              className="w-full rounded bg-rose-600 py-1.5 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-950"
            >
              {tr('kill.engage')}
            </button>
          </div>

          {/* Active Kill Records */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              {tr('kill.active')} ({records.length})
            </h3>
            {records.length === 0 ? (
              <p className="text-emerald-400 text-xs">All planes active. No active kill switches.</p>
            ) : (
              <div className="space-y-1.5">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded border border-rose-900 bg-rose-950/40 p-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-rose-400 me-2">[{r.level}]</span>
                      <span className="font-mono text-slate-200">{r.target}</span>
                      <div className="text-[10px] text-slate-400">{r.reason}</div>
                    </div>
                    <button
                      onClick={() => handleRelease(r.level, r.target)}
                      className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      {tr('kill.release')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={() => setKillModalOpen(false)}
            className="rounded bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            {tr('inspector.close')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmingEngage}
        title={tr('confirm.kill.title')}
        description={tr('confirm.kill.desc', { level, target: level === 'GLOBAL' ? '*' : target })}
        confirmLabel={tr('kill.engage')}
        cancelLabel={tr('confirm.cancel')}
        isDestructive={true}
        onConfirm={executeEngage}
        onCancel={() => setConfirmingEngage(false)}
      />
    </div>
  );
}
