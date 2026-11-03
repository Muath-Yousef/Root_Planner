import { errorCount } from '../../engine/problems';
import { useProblems } from '../../store/useProblems';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';
import type { SaveStatus } from './useAutosave';

export function StatusBar({ saved }: { saved: SaveStatus }) {
  const tr = useT();
  const problems = useProblems();
  const mode = useStudio((s) => s.mode);
  const nodeCount = useStudio((s) => s.nodes.length);
  const setActiveDockTab = useStudio((s) => s.setActiveDockTab);
  const setExportModalOpen = useStudio((s) => s.setExportModalOpen);
  const errs = errorCount(problems);

  let nextStepText = '';
  let nextStepAction: (() => void) | null = null;

  if (nodeCount === 0) {
    nextStepText = tr('status.step.empty');
  } else if (errs > 0) {
    nextStepText = tr('status.step.problems', { n: errs });
    nextStepAction = () => setActiveDockTab('problems');
  } else if (mode === 'simulate') {
    nextStepText = tr('status.step.simulate');
    nextStepAction = () => setActiveDockTab('simulation');
  } else {
    nextStepText = tr('status.step.export');
    nextStepAction = () => setExportModalOpen(true);
  }

  return (
    <footer className="flex flex-wrap items-center gap-4 border-t border-slate-700 bg-slate-950 px-4 py-1.5 text-xs text-slate-300 select-none">
      <span className={errs ? 'font-semibold text-rose-400' : 'text-emerald-400'}>
        {tr('status.errors', { n: errs })}
      </span>
      <span>{tr('status.warnings', { n: problems.length - errs })}</span>
      <span dir="ltr" className="font-mono text-slate-400">
        {nodeCount} nodes
      </span>
      <span className="text-slate-400">
        {tr(mode === 'design' ? 'status.mode.design' : 'status.mode.simulate')}
      </span>

      {/* Next Step Guidance Line */}
      {nextStepText && (
        <div className="flex items-center gap-1.5 text-sky-300 font-medium">
          <span className="text-sky-500 font-bold">💡</span>
          {nextStepAction ? (
            <button
              onClick={nextStepAction}
              className="hover:underline hover:text-white transition-colors text-start"
              dir="auto"
            >
              {nextStepText}
            </button>
          ) : (
            <span dir="auto">{nextStepText}</span>
          )}
        </div>
      )}

      <span className="ms-auto font-mono text-[11px] text-slate-400">
        {tr(saved === 'saving' ? 'status.saving' : 'status.saved')}
      </span>
    </footer>
  );
}
