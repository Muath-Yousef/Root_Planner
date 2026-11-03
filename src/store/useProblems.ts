import { collectProblems, type Problem } from '../engine/problems';
import { createProblemsMemo } from './problemsMemo';
import { useStudio } from './useStudioStore';

const memo = createProblemsMemo((nodes, edges, tenant_id) => collectProblems(nodes, edges, { tenant_id }));
/** The single Problems list shared by the panel, the status bar and the export gate. */
export function useProblems(): Problem[] {
  const nodes = useStudio((s) => s.nodes), edges = useStudio((s) => s.edges), tenant = useStudio((s) => s.tenant_id);
  return memo(nodes, edges, tenant);
}
