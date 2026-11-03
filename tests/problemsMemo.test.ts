import { describe, expect, it } from 'vitest';
import { createProblemsMemo } from '../src/store/problemsMemo';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import type { Problem } from '../src/engine/problems';

describe('problems memo (keeps Ajv off the drag path)', () => {
  it('reuses the cached list when only positions change, recomputes when data, edges or tenant change', () => {
    let calls = 0;
    const memo = createProblemsMemo((): Problem[] => { calls++; return []; });
    const t = buildReferenceTopology('socroot-core');
    const a = memo(t.nodes, t.edges, 'socroot-core');
    const moved = t.nodes.map((n, i) => (i === 0 ? { ...n, position: { x: n.position.x + 5, y: n.position.y } } : n));
    expect(memo(moved, t.edges, 'socroot-core')).toBe(a);
    expect(calls).toBe(1);
    const edited = moved.map((n, i) => (i === 1 ? { ...n, data: { ...n.data } } : n));
    memo(edited, t.edges, 'socroot-core'); expect(calls).toBe(2);
    memo(edited, [...t.edges], 'socroot-core'); expect(calls).toBe(3);
    memo(edited, [...t.edges], 'other_tenant'); expect(calls).toBe(4);
  });
});
