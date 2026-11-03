import { useReactFlow } from '@xyflow/react';
import { errorCount } from '../../engine/problems';
import { useProblems } from '../../store/useProblems';
import { useStudio } from '../../store/useStudioStore';
import { useT } from '../../i18n/useT';

export function ProblemsPanel() {
  const problems = useProblems();
  const select = useStudio((s) => s.select);
  const openInspector = useStudio((s) => s.openInspector);
  const { setCenter, getNode } = useReactFlow();
  const tr = useT();
  const go = (p: { nodeId?: string; tab?: string; field?: string }) => {
    if (!p.nodeId) return;
    const n = getNode(p.nodeId);
    if (n) {
      select(n.id);
      setCenter(n.position.x + 80, n.position.y + 30, { zoom: 1, duration: 300 });
    }
    openInspector(p.nodeId, p.tab ?? 'identity', p.field, true);
  };
  const errs = errorCount(problems);
  return (
    <section aria-label="Problems">
      <h2 className="font-semibold">{tr('problems.title', { errors: errs, warnings: problems.length - errs })}</h2>
      {problems.length === 0 && <p className="text-emerald-400">{tr('problems.none')}</p>}
      <ul className="space-y-1 text-xs">
        {problems.map((p) => (
          <li key={p.id}>
            <button onClick={() => go(p)} className="text-start hover:underline">
              <b dir="ltr" className={p.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}>{p.code}</b> {p.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
