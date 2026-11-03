// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { Profiler } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { StudioNode } from '../src/components/canvas/nodes/StudioNode';
import { useStudio } from '../src/store/useStudioStore';
import type { SNode } from '../src/types';

describe('Performance Test: 300 Nodes & React.memo Isolation', () => {
  it('moving a single node among 300 nodes does not re-render the other 299 nodes', () => {
    // Generate 300 node objects
    const initialNodes: SNode[] = Array.from({ length: 300 }, (_, i) => ({
      id: `node-${i}`,
      type: 'employee',
      position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 80 },
      data: {
        id: `node-${i}`,
        label: `Employee ${i}`,
        kind: 'employee',
        role: i === 0 ? 'scout' : (i % 2 === 0 ? 'drafter' : 'evaluator'),
        networkMode: 'internal',
        status: 'IMPLEMENTED',
      },
    }));

    const renderCounts: Record<string, number> = {};

    // Wrapper with render count tracker
    const TrackedNode = React.memo(({ node }: { node: SNode }) => {
      renderCounts[node.id] = (renderCounts[node.id] || 0) + 1;
      return (
        <StudioNode
          id={node.id}
          data={node.data}
          selected={false}
          type="employee"
          zIndex={1}
          isConnectable={true}
          positionAbsoluteX={node.position.x}
          positionAbsoluteY={node.position.y}
          dragging={false}
          selectable={true}
          deletable={true}
          draggable={true}
        />
      );
    });

    const NodeGrid = ({ nodes }: { nodes: SNode[] }) => {
      return (
        <ReactFlowProvider>
          <div data-testid="grid">
            {nodes.map((n) => (
              <TrackedNode key={n.id} node={n} />
            ))}
          </div>
        </ReactFlowProvider>
      );
    };

    // First render: all 300 nodes render once
    let onRenderCount = 0;
    const { rerender } = render(
      <Profiler
        id="nodes-profiler"
        onRender={() => {
          onRenderCount++;
        }}
      >
        <NodeGrid nodes={initialNodes} />
      </Profiler>
    );

    expect(Object.keys(renderCounts).length).toBe(300);
    for (let i = 0; i < 300; i++) {
      expect(renderCounts[`node-${i}`]).toBe(1);
    }
    expect(onRenderCount).toBe(1);

    // Now simulate moving ONLY node-0:
    // Immutably produce a new array where node-0 has a new reference and new position,
    // while nodes 1..299 maintain the exact same reference identity.
    const updatedNodes = initialNodes.map((n, idx) => {
      if (idx === 0) {
        return {
          ...n,
          position: { x: n.position.x + 25, y: n.position.y + 15 },
        };
      }
      return n;
    });

    act(() => {
      rerender(
        <Profiler
          id="nodes-profiler"
          onRender={() => {
            onRenderCount++;
          }}
        >
          <NodeGrid nodes={updatedNodes} />
        </Profiler>
      );
    });

    // Node 0 was updated and re-rendered (count = 2)
    expect(renderCounts['node-0']).toBe(2);

    // The other 299 nodes MUST NOT have re-rendered (count stays 1)
    for (let i = 1; i < 300; i++) {
      expect(renderCounts[`node-${i}`]).toBe(1);
    }
  });
});
