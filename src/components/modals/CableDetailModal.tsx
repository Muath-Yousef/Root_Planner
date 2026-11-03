import { useStudio } from '../../store/useStudioStore';
import { CABLE_DEFS, getRole } from '../../registry';
import { useT } from '../../i18n/useT';
import { checkCable } from '../../engine/cablingValidator';
import referenceIndex from '../../registry/referenceIndex.generated.json';
import { useModalA11y } from '../layout/useModalA11y';

const SCHEMA_MAP: Record<string, string> = {
  OBJECTIVE_ROUTE: 'objective_route.schema.json (§2.2.5)',
  TASK_DISPATCH_RESULT: 'task_dispatch.schema.json / task_result.schema.json (§2.2.3, §2.2.4)',
  ESCALATION_PATH: 'escalation_package.schema.json (§2.2.6)',
  MEMORY_BUS: 'storage:state_* / storage:vector_* (§5.3)',
  EGRESS_NETWORK: 'SSRFGuard / approved_sources.yaml (§5.4.3)',
  KILL_PLANE_SIGNAL: 'KillPlaneSignal (§4.4, §4.6.1)',
};

const REF_MAP: Record<string, string> = {
  OBJECTIVE_ROUTE: '§3.1.1',
  TASK_DISPATCH_RESULT: '§3.1.3',
  ESCALATION_PATH: '§3.3.1',
  MEMORY_BUS: '§5.3.1',
  EGRESS_NETWORK: '§5.4.3',
  KILL_PLANE_SIGNAL: '§4.4',
};

export function CableDetailModal() {
  const tr = useT();
  const lang = useStudio((s) => s.lang);
  const selectedEdgeId = useStudio((s) => s.selectedCableEdgeId);
  const close = useStudio((s) => s.closeCableModal);
  const edges = useStudio((s) => s.edges);
  const nodes = useStudio((s) => s.nodes);
  const openInspector = useStudio((s) => s.openInspector);
  const onEdgesChange = useStudio((s) => s.onEdgesChange);

  const dialogRef = useModalA11y<HTMLDivElement>(!!selectedEdgeId, close);

  if (!selectedEdgeId) return null;

  const edge = edges.find((e) => e.id === selectedEdgeId);
  if (!edge || !edge.data) return null;

  const cableKind = edge.data.kind;
  const def = CABLE_DEFS[cableKind];
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  const sourceRole = sourceNode ? getRole(sourceNode.data.role) : undefined;
  const targetRole = targetNode ? getRole(targetNode.data.role) : undefined;

  // Run live connection check
  const verdict = sourceNode && targetNode
    ? checkCable(sourceNode, targetNode, cableKind, edge.data.access ?? 'read').verdict
    : { ok: true, reason: 'Valid' };

  const refKey = REF_MAP[cableKind];
  const refEntry = refKey ? (referenceIndex as Record<string, { ref: string; title: string; snippet: string }>)[refKey] : null;

  const handleDelete = () => {
    onEdgesChange([{ type: 'remove', id: edge.id }]);
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cable-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-4 w-4 rounded-full shadow-sm"
              style={{ backgroundColor: def?.color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-400">{cableKind}</span>
                {def?.dashed && (
                  <span className="rounded bg-amber-950 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono">
                    {tr('cable.dashed')}
                  </span>
                )}
              </div>
              <h2 id="cable-modal-title" className="text-sm font-semibold text-slate-100" dir="auto">
                {def?.label[lang] ?? cableKind}
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

        {/* Content */}
        <div className="space-y-4 overflow-y-auto p-5 text-xs text-slate-300">
          {/* Description */}
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="font-medium text-slate-400 uppercase tracking-wide text-[10px] mb-1">
              {tr('cable.description')}
            </div>
            <p className="text-slate-200" dir="auto">
              {def?.description[lang] ?? def?.description.en}
            </p>
          </div>

          {/* Endpoints */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">{tr('cable.source')} (OUT)</span>
              <div className="mt-1 font-semibold text-slate-100">{sourceNode?.data.label ?? edge.source}</div>
              <div className="font-mono text-[11px] text-slate-400">{sourceNode?.data.role} ({sourceNode?.data.kind})</div>
              {sourceNode && (
                <button
                  onClick={() => {
                    close();
                    openInspector(sourceNode.id);
                  }}
                  className="mt-2 text-sky-400 hover:underline font-mono text-[10px] block"
                >
                  ↗ {tr('info.open_inspector')}
                </button>
              )}
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">{tr('cable.target')} (IN)</span>
              <div className="mt-1 font-semibold text-slate-100">{targetNode?.data.label ?? edge.target}</div>
              <div className="font-mono text-[11px] text-slate-400">{targetNode?.data.role} ({targetNode?.data.kind})</div>
              {targetNode && (
                <button
                  onClick={() => {
                    close();
                    openInspector(targetNode.id);
                  }}
                  className="mt-2 text-sky-400 hover:underline font-mono text-[10px] block"
                >
                  ↗ {tr('info.open_inspector')}
                </button>
              )}
            </div>
          </div>

          {/* Schema & Permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">{tr('cable.schema')}:</span>
              <span className="font-mono text-sky-300">{SCHEMA_MAP[cableKind] ?? 'n/a'}</span>
            </div>
            {cableKind === 'MEMORY_BUS' && (
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">{tr('cable.access')}:</span>
                <span className="font-mono font-bold uppercase text-purple-300">
                  {edge.data.access ?? 'read'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">{tr('cable.status')}:</span>
              <span
                className={`font-mono font-bold ${
                  verdict.ok ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {verdict.ok ? tr('sim.status.ok') : tr('sim.status.blocked')}
              </span>
            </div>
          </div>

          {/* Master Reference Grounding */}
          {refEntry && (
            <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3 text-amber-200 text-xs">
              <div className="font-semibold text-amber-400 flex items-center justify-between mb-1">
                <span>{refEntry.ref} — {refEntry.title}</span>
                <span className="text-[10px] uppercase font-mono">{tr('info.master_reference')}</span>
              </div>
              <p className="italic text-amber-100/70" dir="auto">«{refEntry.snippet}»</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={handleDelete}
            className="rounded bg-rose-950 border border-rose-800 px-3 py-1.5 text-rose-300 hover:bg-rose-900 hover:text-white text-xs font-medium"
          >
            {tr('cable.delete')}
          </button>
          <button
            onClick={close}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 text-xs"
          >
            {tr('inspector.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
