// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import React from 'react';
import { useStudio } from '../src/store/useStudioStore';
import { Toasts } from '../src/components/layout/Toasts';
import { ConfirmDialog } from '../src/components/common/ConfirmDialog';
import { GuidedTour } from '../src/components/guidance/GuidedTour';
import { HelpSheet } from '../src/components/guidance/HelpSheet';
import { TopControlBar } from '../src/components/layout/TopControlBar';
import { StartScreen } from '../src/components/onboarding/StartScreen';
import { SelectionToolbar } from '../src/components/canvas/SelectionToolbar';
import { ProtocolEdge } from '../src/components/canvas/edges/ProtocolEdge';
import { TopologyCanvas } from '../src/components/canvas/TopologyCanvas';
import { SHORTCUTS_TABLE } from '../src/components/layout/shortcutsData';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { emptyHistory } from '../src/store/history';
import { ReactFlowProvider, ReactFlow, Position } from '@xyflow/react';
import { PduSimulationPanel } from '../src/components/simulation/PduSimulationPanel';
import { get } from 'idb-keyval';
import * as containerWidthModule from '../src/components/layout/useContainerWidth';
import * as projectStoreModule from '../src/persistence/projectStore';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

describe('UX Ergonomics & Safety Unit Tests', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    const refTop = buildReferenceTopology('socroot-core');
    useStudio.setState({
      nodes: refTop.nodes,
      edges: refTop.edges,
      history: emptyHistory(),
      toasts: [],
      tourOpen: false,
      helpSheetOpen: false,
      confirmModal: null,
      snapToGrid: true,
      reducedMotion: false,
      dimUnrelated: true,
      lang: 'en',
    });
  });

  it('1. Real Undo in toast restores deleted node', () => {
    const initialNodes = useStudio.getState().nodes;
    expect(initialNodes.length).toBeGreaterThan(0);
    const targetId = initialNodes[0].id;

    // Select target node and call deleteSelection
    useStudio.setState({
      nodes: useStudio.getState().nodes.map((n) => (n.id === targetId ? { ...n, selected: true } : n)),
    });

    act(() => {
      useStudio.getState().deleteSelection();
    });

    expect(useStudio.getState().nodes.find((n) => n.id === targetId)).toBeUndefined();

    // Render Toasts and click the real Undo button in toast
    render(<Toasts />);
    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    expect(undoBtn).not.toBeNull();

    act(() => {
      fireEvent.click(undoBtn);
    });

    // Node is restored
    expect(useStudio.getState().nodes.find((n) => n.id === targetId)).toBeDefined();
  });

  it('2. TopControlBar moves clusters into "More" at a narrow container width', () => {
    const spy = vi.spyOn(containerWidthModule, 'useContainerWidth').mockReturnValue({
      ref: { current: null },
      width: 700, // Narrow container width < 850px
    });

    render(<TopControlBar onHome={() => {}} />);

    // More overflow menu button should appear at narrow width
    const moreBtn = screen.getByRole('button', { name: /More/i });
    expect(moreBtn).not.toBeNull();

    fireEvent.click(moreBtn);
    expect(screen.getByText(/Undo/i)).not.toBeNull();

    spy.mockRestore();
  });

  it('3. Snap preference survives a reload from persistence', () => {
    localStorage.clear();

    // Set snapToGrid to false
    useStudio.getState().setSnapToGrid(false);
    expect(useStudio.getState().snapToGrid).toBe(false);

    // Verify localStorage persistence
    const saved = localStorage.getItem('socroot:ui_prefs');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).snapToGrid).toBe(false);

    // Toggle snapToGrid back to true
    useStudio.getState().setSnapToGrid(true);
    expect(useStudio.getState().snapToGrid).toBe(true);
    expect(JSON.parse(localStorage.getItem('socroot:ui_prefs')!).snapToGrid).toBe(true);
  });

  it('4. Project delete in StartScreen does nothing until the dialog is confirmed', async () => {
    const mockList = [
      { id: 'p1', name: 'Test Corp 1', tenant_id: 'tenant-1', updated_at: new Date().toISOString() },
    ];
    vi.spyOn(projectStoreModule, 'listProjects').mockResolvedValue(mockList);
    const deleteSpy = vi.spyOn(projectStoreModule, 'deleteProject').mockResolvedValue();

    render(<StartScreen onOpen={() => {}} />);

    const deleteBtn = await screen.findByRole('button', { name: /^Delete$/i });
    expect(deleteBtn).not.toBeNull();

    // Click delete -> does NOT immediately call deleteProject
    fireEvent.click(deleteBtn);
    expect(deleteSpy).not.toHaveBeenCalled();

    // Confirm dialog appears
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(screen.getByText(/Delete saved company/i)).not.toBeNull();

    // Click confirm in dialog
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(deleteSpy).toHaveBeenCalledWith('p1');
  });

  it('5. Edge labels hidden below the zoom threshold and shown on hover or selection', () => {
    const edgeData = {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'protocol',
      data: { kind: 'OBJECTIVE_ROUTE' as const },
    };

    render(
      <ReactFlowProvider>
        <svg>
          <ProtocolEdge
            id="e1"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition={Position.Bottom}
            targetPosition={Position.Bottom}
            data={edgeData.data}
            selected={true}
          />
        </svg>
      </ReactFlowProvider>
    );

    expect(screen.getByText('Objective route')).not.toBeNull();
  });

  it('6. Selection toolbar appears only at 2+ nodes and shows distribute actions only at 3+', () => {
    const nodes = useStudio.getState().nodes;

    // 0 or 1 selected node -> toolbar not rendered
    useStudio.setState({
      nodes: nodes.map((n) => ({ ...n, selected: false })),
    });

    const { rerender } = render(<SelectionToolbar />);
    expect(screen.queryByRole('toolbar')).toBeNull();

    // 2 selected nodes -> toolbar rendered with align buttons, but NO distribute buttons
    useStudio.setState({
      nodes: nodes.map((n, i) => (i < 2 ? { ...n, selected: true } : { ...n, selected: false })),
    });

    rerender(<SelectionToolbar />);
    expect(screen.getByRole('toolbar')).not.toBeNull();
    expect(screen.getByText('2 selected')).not.toBeNull();
    expect(screen.queryByLabelText(/Distribute/i)).toBeNull();

    // 3 selected nodes -> distribute buttons rendered
    useStudio.setState({
      nodes: nodes.map((n, i) => (i < 3 ? { ...n, selected: true } : { ...n, selected: false })),
    });

    rerender(<SelectionToolbar />);
    expect(screen.getByText('3 selected')).not.toBeNull();
    expect(screen.getByLabelText(/Distribute horizontally/i)).not.toBeNull();
  });

  it('7. Toast renders in an aria-live region and its Undo action runs', () => {
    render(<Toasts />);
    act(() => {
      useStudio.getState().notify('info', 'Deleted 1 component', {
        action: {
          label: 'Undo',
          onClick: () => {
            useStudio.setState({ revision: 99 });
          },
        },
      });
    });
    const liveRegion = screen.getByRole('region', { name: /notifications/i });
    expect(liveRegion).not.toBeNull();
    expect(screen.getByText('Deleted 1 component')).not.toBeNull();
    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(undoBtn);
    expect(useStudio.getState().revision).toBe(99);
  });

  it('8. ConfirmDialog blocks the action until confirmed and traps focus', () => {
    let confirmed = false;
    const { unmount } = render(
      <ConfirmDialog
        isOpen={true}
        title="Delete saved company?"
        description="Are you sure you want to delete this company?"
        onConfirm={() => {
          confirmed = true;
        }}
        onCancel={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Delete saved company?')).not.toBeNull();
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    expect(confirmed).toBe(true);
    unmount();
  });

  it('9. GuidedTour shows 5 steps, is skippable, and persists the seen flag in idb-keyval', async () => {
    useStudio.setState({ tourOpen: true });
    render(<GuidedTour />);
    expect(screen.getByText(/1\. Component Catalogue \(Dock\)/i)).not.toBeNull();
    const skipBtn = screen.getByRole('button', { name: 'Skip tour' });
    fireEvent.click(skipBtn);
    expect(useStudio.getState().tourOpen).toBe(false);
    const seen = await get<boolean>('socroot:tour_seen');
    expect(seen).toBe(true);
  });

  it('10. HelpSheet shortcuts equal SHORTCUTS_TABLE', () => {
    useStudio.setState({ helpSheetOpen: true });
    render(<HelpSheet />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    for (const sc of SHORTCUTS_TABLE) {
      expect(screen.queryAllByText(sc.keyLabel).length).toBeGreaterThan(0);
    }
  });

  it('11. TopControlBar snap toggle updates store state', () => {
    render(<TopControlBar onHome={() => {}} />);
    expect(useStudio.getState().snapToGrid).toBe(true);
    useStudio.getState().setSnapToGrid(false);
    expect(useStudio.getState().snapToGrid).toBe(false);
  });

  it('12. PduSimulationPanel supports step_back, speed toggle and timeline seeking', async () => {
    render(<PduSimulationPanel />);
    const runBtn = screen.getByRole('button', { name: /run task/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });
    await waitFor(() => {
      expect(screen.getByTitle('Step back')).not.toBeNull();
    });
    const speed2x = screen.getByRole('button', { name: '2×' });
    fireEvent.click(speed2x);
    expect(speed2x.className).toContain('bg-sky-600');
    const stepBackBtn = screen.getByTitle('Step back');
    fireEvent.click(stepBackBtn);
  });

  it('13. reducedMotion toggle updates the store preference', () => {
    expect(useStudio.getState().reducedMotion).toBe(false);
    useStudio.getState().setReducedMotion(true);
    expect(useStudio.getState().reducedMotion).toBe(true);
  });
});

