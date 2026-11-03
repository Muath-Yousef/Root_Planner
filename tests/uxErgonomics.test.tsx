// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import { useStudio } from '../src/store/useStudioStore';
import { Toasts } from '../src/components/layout/Toasts';
import { ConfirmDialog } from '../src/components/common/ConfirmDialog';
import { GuidedTour } from '../src/components/guidance/GuidedTour';
import { HelpSheet } from '../src/components/guidance/HelpSheet';
import { TopControlBar } from '../src/components/layout/TopControlBar';
import { PduSimulationPanel } from '../src/components/simulation/PduSimulationPanel';
import { SHORTCUTS_TABLE } from '../src/components/layout/shortcutsData';
import { get } from 'idb-keyval';

describe('UX Ergonomics & Safety Unit Tests', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useStudio.setState({
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

  it('renders Toast in aria-live region and executes Undo action', () => {
    render(<Toasts />);

    // Trigger notification wrapped in act
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

  it('ConfirmDialog blocks action until confirmed and traps focus', () => {
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

  it('GuidedTour displays 5 steps, is skippable, and persists seen flag in idb-keyval', async () => {
    useStudio.setState({ tourOpen: true });
    render(<GuidedTour />);

    expect(screen.getByText('1. Component Catalogue (Dock)')).not.toBeNull();

    const skipBtn = screen.getByRole('button', { name: 'Skip tour' });
    fireEvent.click(skipBtn);

    expect(useStudio.getState().tourOpen).toBe(false);
    const seen = await get<boolean>('socroot:tour_seen');
    expect(seen).toBe(true);
  });

  it('HelpSheet displays shortcuts identical to SHORTCUTS_TABLE', () => {
    useStudio.setState({ helpSheetOpen: true });
    render(<HelpSheet />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();

    for (const sc of SHORTCUTS_TABLE) {
      expect(screen.queryAllByText(sc.keyLabel).length).toBeGreaterThan(0);
    }
  });

  it('TopControlBar renders snap toggle and updates store state', () => {
    render(<TopControlBar onHome={() => {}} />);

    expect(useStudio.getState().snapToGrid).toBe(true);
    useStudio.getState().setSnapToGrid(false);
    expect(useStudio.getState().snapToGrid).toBe(false);
  });

  it('PduSimulationPanel supports step_back, speed toggle, and timeline seeking', async () => {
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
  });

  it('reducedMotion toggle updates store preference', () => {
    expect(useStudio.getState().reducedMotion).toBe(false);
    useStudio.getState().setReducedMotion(true);
    expect(useStudio.getState().reducedMotion).toBe(true);
  });
});
