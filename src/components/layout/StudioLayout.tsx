import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStudio } from '../../store/useStudioStore';
import { TopologyCanvas } from '../canvas/TopologyCanvas';
import { ProblemsPanel } from '../problems/ProblemsPanel';
import { PduSimulationPanel } from '../simulation/PduSimulationPanel';
import { Dock } from './Dock';
import { StatusBar } from './StatusBar';
import { TopControlBar } from './TopControlBar';
import { Toasts } from './Toasts';
import { useAutosave } from './useAutosave';
import { useShortcuts } from './useShortcuts';
import { ErrorBoundary } from './ErrorBoundary';
import { DeviceInspectorDrawer } from '../inspector/DeviceInspectorDrawer';
import { EmployeeFactoryModal } from '../modals/EmployeeFactoryModal';
import { SocrootAdminCliModal } from '../modals/SocrootAdminCliModal';
import { BreakGlassModal } from '../modals/BreakGlassModal';
import { CompanyTenantModal } from '../modals/CompanyTenantModal';
import { KillPlaneModal } from '../modals/KillPlaneModal';
import { ExportBundleModal } from '../modals/ExportBundleModal';
import { CommandPaletteModal } from '../modals/CommandPaletteModal';
import { ComponentInfoModal } from '../modals/ComponentInfoModal';
import { CableDetailModal } from '../modals/CableDetailModal';
import { ConfigEditorModal } from '../modals/ConfigEditorModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GuidedTour } from '../guidance/GuidedTour';
import { HelpSheet } from '../guidance/HelpSheet';
import { useT } from '../../i18n/useT';
import { get } from 'idb-keyval';

/** The working screen: top bar, canvas, side panel (dockable tabs for Problems and Simulation), dock, status bar. */
export function StudioLayout({ onHome }: { onHome: () => void }) {
  const mode = useStudio((s) => s.mode);
  const activeDockTab = useStudio((s) => s.activeDockTab);
  const setActiveDockTab = useStudio((s) => s.setActiveDockTab);
  const confirmModal = useStudio((s) => s.confirmModal);
  const closeConfirm = useStudio((s) => s.closeConfirm);
  const setTourOpen = useStudio((s) => s.setTourOpen);
  const saved = useAutosave();
  const tr = useT();

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const savedWidth = localStorage.getItem('socroot:panel_width');
      return savedWidth ? Math.max(280, Math.min(600, parseInt(savedWidth, 10))) : 380;
    } catch {
      return 380;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  useShortcuts();

  // Auto-collapse side panel on small screens (< 1100 px) & check first-run tour
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 1100) {
        setPanelCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);

    // Check first run tour via IndexedDB
    if (import.meta.env.MODE !== 'test') {
      void get<boolean>('socroot:tour_seen').then((seen) => {
        if (!seen) {
          setTourOpen(true);
        }
      });
    }

    return () => window.removeEventListener('resize', checkWidth);
  }, [setTourOpen]);

  // Mouse move handler for resizing side panel
  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(600, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
      try {
        localStorage.setItem('socroot:panel_width', String(newWidth));
      } catch {}
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <TopControlBar onHome={onHome} />
        <div className="flex min-h-0 flex-1 relative overflow-hidden">
          <TopologyCanvas />

          {/* Resizable & Collapsible Side Panel with Dockable Tabs */}
          <div className="relative flex">
            {/* Collapse toggle tab button */}
            <button
              onClick={() => setPanelCollapsed(!panelCollapsed)}
              className="absolute -start-6 top-4 z-20 flex h-10 w-6 items-center justify-center rounded-s border border-e-0 border-slate-700 bg-slate-900 text-xs text-slate-400 hover:text-white transition-colors"
              title={panelCollapsed ? tr('panel.expand') : tr('panel.collapse')}
              aria-label={panelCollapsed ? tr('panel.expand') : tr('panel.collapse')}
            >
              {panelCollapsed ? '◀' : '▶'}
            </button>

            {!panelCollapsed && (
              <div className="flex relative">
                {/* Drag handle for resizing */}
                <div
                  onMouseDown={() => setIsResizing(true)}
                  className="w-1.5 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-10 transition-colors"
                  title="Drag to resize panel"
                />

                <aside
                  style={{ width: `${panelWidth}px` }}
                  className="shrink-0 space-y-3 overflow-y-auto border-s border-slate-700 bg-slate-900 p-3 text-sm transition-all flex flex-col"
                >
                  {/* Dockable Header Tabs: Problems | Simulation */}
                  <div className="flex border-b border-slate-800 bg-slate-950 p-1 rounded-lg gap-1">
                    <button
                      onClick={() => setActiveDockTab('problems')}
                      className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                        activeDockTab === 'problems'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tr('panel.tab.problems')}
                    </button>
                    <button
                      onClick={() => setActiveDockTab('simulation')}
                      className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                        activeDockTab === 'simulation'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tr('panel.tab.simulation')}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <ErrorBoundary>
                      {activeDockTab === 'simulation' ? <PduSimulationPanel /> : <ProblemsPanel />}
                    </ErrorBoundary>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>

        {mode === 'design' && <Dock />}
        <StatusBar saved={saved} />

        {/* Global Feedback Toasts */}
        <Toasts />

        {/* Global Confirmation Modal */}
        {confirmModal && (
          <ConfirmDialog
            isOpen={!!confirmModal}
            title={confirmModal.title}
            description={confirmModal.description}
            confirmLabel={confirmModal.confirmLabel}
            cancelLabel={confirmModal.cancelLabel}
            isDestructive={confirmModal.isDestructive}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => {
              if (confirmModal.onCancel) confirmModal.onCancel();
              closeConfirm();
            }}
          />
        )}

        {/* Guidance: Tour & Help Sheet */}
        <GuidedTour />
        <HelpSheet />

        {/* Dynamic Modals & Drawers */}
        <DeviceInspectorDrawer />
        <EmployeeFactoryModal />
        <SocrootAdminCliModal />
        <BreakGlassModal />
        <CompanyTenantModal />
        <KillPlaneModal />
        <ExportBundleModal />
        <CommandPaletteModal />
        <ComponentInfoModal />
        <CableDetailModal />
        <ConfigEditorModal />
      </div>
    </ReactFlowProvider>
  );
}
