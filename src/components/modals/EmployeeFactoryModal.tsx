import { useState, useMemo, useRef } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { getRole } from '../../registry';
import { TRIGGER_TYPES, type TriggerType } from '../../engine/qualityGates';
import { previewFactory, placeEmployee } from '../../engine/factoryPlacement';
import { useT } from '../../i18n/useT';
import { useModalA11y } from '../layout/useModalA11y';

export function EmployeeFactoryModal() {
  const tr = useT();
  const factoryModal = useStudio((s) => s.factoryModal);
  const closeFactoryModal = useStudio((s) => s.closeFactoryModal);
  const addEmployeeFromFactory = useStudio((s) => s.addEmployeeFromFactory);
  const nodes = useStudio((s) => s.nodes);
  const tenant_id = useStudio((s) => s.tenant_id);

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>('TRUST_BOUNDARY');
  const [justification, setJustification] = useState(
    'Requires dedicated network isolation to prevent proposal leakage and prompt injection exfiltration.'
  );
  const [repeatCount, setRepeatCount] = useState(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen: Boolean(factoryModal),
    onClose: closeFactoryModal,
    dialogRef,
  });

  const roleDef = useMemo(() => {
    return factoryModal ? getRole(factoryModal.roleId) : undefined;
  }, [factoryModal]);

  const preview = useMemo(() => {
    if (!factoryModal || !roleDef) return null;
    return previewFactory(
      {
        roleId: factoryModal.roleId,
        position: factoryModal.position,
        tenant_id,
        nodes,
        name: name.trim() || undefined,
      },
      {
        trigger,
        justification,
        repeat_count: repeatCount,
      }
    );
  }, [factoryModal, roleDef, tenant_id, nodes, name, trigger, justification, repeatCount]);

  if (!factoryModal || !roleDef) return null;

  const handleHire = () => {
    setErrorMsg(null);
    if (!preview || 'error' in preview || !preview.ready) return;
    const res = placeEmployee(
      {
        roleId: factoryModal.roleId,
        position: factoryModal.position,
        tenant_id,
        nodes,
        name: name.trim() || undefined,
      },
      preview.config
    );
    if (!res.ok) {
      setErrorMsg(res.reason);
      return;
    }
    addEmployeeFromFactory(res.node, res.edges);
  };

  const isReady = preview && !('error' in preview) && preview.ready;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="factory-modal-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div>
            <div className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider">
              {tr('factory.title')}
            </div>
            <h2 id="factory-modal-title" className="text-base font-bold text-slate-100">
              {roleDef.label.en} ({roleDef.label.ar})
            </h2>
          </div>
          <button
            onClick={closeFactoryModal}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Employee Basic Config */}
          <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div>
              <label className="text-slate-400 font-medium">{tr('factory.name')}</label>
              <input
                placeholder={roleDef.label.en}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            {preview && !('error' in preview) && (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                <div>
                  <span className="text-slate-500">Employee ID: </span>
                  <span className="text-sky-400">{preview.id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Department: </span>
                  <span className="text-emerald-400">{preview.home.department}</span>
                </div>
                <div>
                  <span className="text-slate-500">Manager: </span>
                  <span className="text-amber-400">{preview.home.manager_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Network: </span>
                  <span className="text-cyan-400">{roleDef.network ?? 'internal'}</span>
                </div>
              </div>
            )}
          </section>

          {/* Rule of Three & Intake Form (§6.3.1) */}
          <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              {tr('factory.rule3')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400">{tr('factory.trigger')}</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as TriggerType)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400">Pattern Repeat Count (min 3 if not boundary)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400">{tr('factory.justification')}</label>
              <textarea
                rows={2}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </section>

          {/* The 4 Quality Gates (§6.8) */}
          <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              {tr('factory.gates')} (§6.8)
            </h3>
            {preview && 'error' in preview ? (
              <p className="text-rose-400">{preview.error}</p>
            ) : preview ? (
              <div className="space-y-1.5">
                {preview.gates.map((g) => (
                  <div
                    key={g.id}
                    className={`flex items-center justify-between rounded p-2 text-xs border ${
                      g.ok ? 'border-emerald-900 bg-emerald-950/30 text-emerald-200' : 'border-rose-900 bg-rose-950/30 text-rose-200'
                    }`}
                  >
                    <div>
                      <span className="font-semibold uppercase tracking-wider font-mono me-2">
                        Gate: {g.id}
                      </span>
                      <span className="text-[11px] opacity-90">{g.detail}</span>
                    </div>
                    <span className={`font-bold ${g.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {g.ok ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={closeFactoryModal}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            {tr('wizard.cancel')}
          </button>
          <button
            disabled={!isReady}
            onClick={handleHire}
            className="rounded bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {tr('factory.place')}
          </button>
        </div>
      </div>
    </div>
  );
}
