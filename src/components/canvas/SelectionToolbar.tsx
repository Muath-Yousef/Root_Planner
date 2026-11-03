import { useStudio } from '../../store/useStudioStore';
import { selectedIds } from '../../store/graphOps';
import { useT } from '../../i18n/useT';

export function SelectionToolbar() {
  const tr = useT();
  const nodes = useStudio((s) => s.nodes);
  const alignSelected = useStudio((s) => s.alignSelected);
  const distributeSelected = useStudio((s) => s.distributeSelected);
  const duplicate = useStudio((s) => s.duplicate);
  const requestDeleteSelection = useStudio((s) => s.requestDeleteSelection);

  const selectedCount = selectedIds(nodes).length;

  if (selectedCount < 2) return null;

  return (
    <div
      role="toolbar"
      aria-label="Selection alignment and formatting toolbar"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md text-xs text-slate-200 select-none animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-sky-400 font-semibold border border-slate-700">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-slate-700 my-auto" />

      {/* Align group: 2+ nodes */}
      <div className="flex items-center gap-1" role="group" aria-label="Align controls">
        <button
          onClick={() => alignSelected('left')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.left')}
          aria-label={tr('canvas.align.left')}
        >
          <span className="font-mono font-bold">├─</span>
        </button>
        <button
          onClick={() => alignSelected('hcenter')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.center')}
          aria-label={tr('canvas.align.center')}
        >
          <span className="font-mono font-bold">┼</span>
        </button>
        <button
          onClick={() => alignSelected('right')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.right')}
          aria-label={tr('canvas.align.right')}
        >
          <span className="font-mono font-bold">─┤</span>
        </button>
        <button
          onClick={() => alignSelected('top')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.top')}
          aria-label={tr('canvas.align.top')}
        >
          <span className="font-mono font-bold">┬</span>
        </button>
        <button
          onClick={() => alignSelected('vcenter')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.middle')}
          aria-label={tr('canvas.align.middle')}
        >
          <span className="font-mono font-bold">╪</span>
        </button>
        <button
          onClick={() => alignSelected('bottom')}
          className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
          title={tr('canvas.align.bottom')}
          aria-label={tr('canvas.align.bottom')}
        >
          <span className="font-mono font-bold">┴</span>
        </button>
      </div>

      {/* Distribute group: 3+ nodes only */}
      {selectedCount >= 3 && (
        <>
          <div className="h-4 w-px bg-slate-700 my-auto" />
          <div className="flex items-center gap-1" role="group" aria-label="Distribute controls">
            <button
              onClick={() => distributeSelected('x')}
              className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
              title={tr('canvas.distribute.x')}
              aria-label={tr('canvas.distribute.x')}
            >
              <span className="font-mono font-bold">┆ ┆ ┆</span>
            </button>
            <button
              onClick={() => distributeSelected('y')}
              className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring"
              title={tr('canvas.distribute.y')}
              aria-label={tr('canvas.distribute.y')}
            >
              <span className="font-mono font-bold">┄ ┄ ┄</span>
            </button>
          </div>
        </>
      )}

      <div className="h-4 w-px bg-slate-700 my-auto" />

      {/* Actions */}
      <button
        onClick={duplicate}
        className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors focus-ring text-slate-300"
        title="Duplicate selection"
        aria-label="Duplicate selection"
      >
        <span>📋</span>
      </button>
      <button
        onClick={requestDeleteSelection}
        className="rounded p-1.5 hover:bg-rose-950/80 hover:text-rose-300 transition-colors focus-ring text-rose-400"
        title="Delete selection"
        aria-label="Delete selection"
      >
        <span>🗑️</span>
      </button>
    </div>
  );
}
