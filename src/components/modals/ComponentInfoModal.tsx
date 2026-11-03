import { useStudio } from '../../store/useStudioStore';
import { getRole, getRoleHelp, CABLE_DEFS } from '../../registry';
import { useT } from '../../i18n/useT';
import referenceIndex from '../../registry/referenceIndex.generated.json';
import { useModalA11y } from '../layout/useModalA11y';

export function ComponentInfoModal() {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const roleId = useStudio((s) => s.infoModalRoleId);
  const close = useStudio((s) => s.closeInfoModal);
  const openInspector = useStudio((s) => s.openInspector);
  const nodes = useStudio((s) => s.nodes);

  const dialogRef = useModalA11y<HTMLDivElement>(!!roleId, close);

  if (!roleId) return null;

  const def = getRole(roleId);
  if (!def) return null;

  const help = getRoleHelp(def);
  const refKey = def.ref?.split('/')[0]?.trim();
  const refEntry = refKey ? (referenceIndex as Record<string, { ref: string; title: string; snippet: string }>)[refKey] : null;

  const matchingNode = nodes.find((n) => n.data.role === roleId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-950 border border-sky-800 text-sky-400 font-bold text-sm">
              ℹ
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-sky-400 font-bold">{def.id}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                  {def.kind}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {def.category}
                </span>
              </div>
              <h2 id="info-modal-title" className="text-base font-semibold text-slate-100" dir="auto">
                {def.label[lang] ?? def.label.en}
              </h2>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={tr('inspector.close')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-5 text-sm text-slate-300">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1">
              <span className="text-slate-400">{tr('top.horizon')}: </span>
              <span className="font-mono text-amber-300 font-semibold">{def.architecture_horizon}</span>
            </div>
            <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1">
              <span className="text-slate-400">{tr('info.status')}: </span>
              <span className="font-mono text-emerald-400 font-semibold">{def.implementation_status}</span>
            </div>
            {def.network && (
              <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1">
                <span className="text-slate-400">{tr('inspector.network')}: </span>
                <span className="font-mono text-cyan-300">{def.network}</span>
              </div>
            )}
            {def.employee?.autonomy_level !== undefined && (
              <div className="rounded border border-slate-700 bg-slate-800/70 px-2 py-1">
                <span className="text-slate-400">{tr('info.autonomy')}: </span>
                <span className="font-mono text-purple-300 font-semibold">L{def.employee.autonomy_level}</span>
              </div>
            )}
            {def.ref && (
              <div className="rounded border border-sky-800 bg-sky-950/60 px-2 py-1">
                <span className="text-slate-400">{tr('info.ref')}: </span>
                <span className="font-mono text-sky-300 font-bold">{def.ref}</span>
              </div>
            )}
          </div>

          {/* Bilingual Help / Architecture Guidance */}
          <div className="rounded-lg border border-slate-700/80 bg-slate-950/70 p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wide">{tr('info.purpose')}</h4>
              <p className="mt-1 text-slate-200" dir="auto">{help.purpose[lang]}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wide">{tr('info.when_to_use')}</h4>
              <p className="mt-1 text-slate-300" dir="auto">{help.when_to_use[lang]}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wide">{tr('info.how_to_connect')}</h4>
              <p className="mt-1 text-slate-300" dir="auto">{help.how_to_connect[lang]}</p>
            </div>
          </div>

          {/* Reference Snippet from Master Reference */}
          {refEntry && (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3.5 text-xs">
              <div className="flex items-center justify-between text-amber-300 font-bold mb-1">
                <span dir="auto">{refEntry.ref} — {refEntry.title}</span>
                <span className="text-[10px] font-mono text-amber-500 uppercase">{tr('info.master_reference')}</span>
              </div>
              <p className="text-amber-100/80 italic leading-relaxed" dir="auto">
                «{refEntry.snippet}»
              </p>
            </div>
          )}

          {/* Port Definitions */}
          {def.ports && def.ports.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{tr('info.ports')} ({def.ports.length})</h4>
              <div className="grid grid-cols-2 gap-2">
                {def.ports.map((p) => {
                  const cableDef = CABLE_DEFS[p.cable];
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cableDef?.color }} />
                        <span className="font-mono text-[11px] text-slate-200">{p.id}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 uppercase">
                        {p.direction} · {cableDef?.label[lang] ?? p.cable}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permissions & Least Privilege */}
          {def.permissions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{tr('info.permissions')}</h4>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    def.permissions.source === 'reference'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {def.permissions.source === 'reference' ? tr('info.perm.reference') : tr('info.perm.derived')}
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="text-emerald-400">
                  <span className="font-semibold text-slate-400">{tr('info.grants')}: </span>
                  {def.permissions.grants.length ? def.permissions.grants.join(', ') : 'none'}
                </div>
                {def.permissions.prohibitions.length > 0 && (
                  <div className="text-rose-400">
                    <span className="font-semibold text-slate-400">{tr('info.prohibitions')}: </span>
                    {def.permissions.prohibitions.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skills Files */}
          {def.employee?.skills && def.employee.skills.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{tr('inspector.skills')}</h4>
              <div className="flex flex-wrap gap-1">
                {def.employee.skills.map((s) => (
                  <span key={s.name} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-sky-300">
                    📄 {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3 text-xs">
          {matchingNode ? (
            <button
              onClick={() => {
                close();
                openInspector(matchingNode.id);
              }}
              className="rounded bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-500 font-medium"
            >
              {tr('info.open_inspector')}
            </button>
          ) : (
            <span className="text-slate-500">{tr('info.drag_to_canvas')}</span>
          )}
          <button
            onClick={close}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700"
          >
            {tr('inspector.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
