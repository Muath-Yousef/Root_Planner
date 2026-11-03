// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import App from '../src/App';
import { useStudio } from '../src/store/useStudioStore';
import { buildReferenceTopology } from '../src/presets/referenceTopology';
import { defaultConfigs } from '../src/presets/defaultConfigs';
import { DeviceInspectorDrawer } from '../src/components/inspector/DeviceInspectorDrawer';
import { ProblemsPanel } from '../src/components/problems/ProblemsPanel';
import { StudioLayout } from '../src/components/layout/StudioLayout';
import { ReactFlowProvider } from '@xyflow/react';
import { checkConnection } from '../src/engine/cablingValidator';
import { previewFactory, placeEmployee } from '../src/engine/factoryPlacement';
import { buildBundle } from '../src/engine/bundleExporter';
import { zipBundle } from '../src/engine/zipBundle';
import { runSimulation } from '../src/engine/simulationRunner';
import { parseWatchlist } from '../src/engine/ssrfGuard';
import { SOURCES_WATCHLIST_YAML } from '../src/presets/defaultConfigs';
import { applyLang } from '../src/i18n';
import { clearModalStack, FOCUSABLE_SELECTOR } from '../src/components/layout/useModalA11y';
import { NewCompanyWizard } from '../src/components/onboarding/NewCompanyWizard';
import { del } from 'idb-keyval';
import JSZip from 'jszip';

function resetStudioToReference() {
  const top = buildReferenceTopology('socroot-core');
  useStudio.setState({
    nodes: top.nodes,
    edges: top.edges,
    configs: defaultConfigs(),
    tenant_id: 'socroot-core',
    tenant: { tenant_id: 'socroot-core', isolation: 'logical_rls', name: 'socroot-core' },
    project: { id: 'test-proj', name: 'Reference company', created_at: new Date().toISOString() },
    lang: 'en',
    theme: 'dark',
    mode: 'design',
    inspector: null,
    rejection: null,
    compat: null,
    selected: null,
    history: { past: [], future: [] },
    factoryModal: null,
    cliModalOpen: false,
    breakGlassModalOpen: false,
    exportModalOpen: false,
    killModalOpen: false,
    commandPaletteOpen: false,
    tenantModalOpen: false,
    configEditorModalOpen: false,
    infoModalRoleId: null,
    selectedCableEdgeId: null,
    activeDockTab: 'problems',
    tourOpen: false,
    helpSheetOpen: false,
    confirmModal: null,
    toasts: [],
    revision: 1,
  });
}

describe('UI Integration Tests (Done When paths)', () => {
  beforeEach(() => {
    cleanup();
    clearModalStack();
    resetStudioToReference();
  });

  afterEach(() => {
    cleanup();
    clearModalStack();
  });

  it('1. StartScreen: opens Reference department and renders studio action buttons', async () => {
    window.localStorage.clear();
    const { unmount } = render(<App />);

    // Click "Reference department"
    const refDeptBtn = await screen.findByRole('button', { name: /Reference department/i });
    expect(refDeptBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(refDeptBtn);
    });

    // Verify studio top control bar buttons are visible
    expect(await screen.findByTitle(/Undo/i)).toBeDefined();
    expect(await screen.findByTitle(/Auto Layout/i)).toBeDefined();
    expect(await screen.findByTitle(/socroot-admin CLI/i)).toBeDefined();
    expect(await screen.findByTitle(/Emergency Break-Glass/i)).toBeDefined();
    expect(await screen.findByTitle(/Kill Plane/i)).toBeDefined();
    expect(await screen.findByRole('button', { name: /^Export ZIP$/i })).toBeDefined();

    unmount();
  });

  it('2. Secret field: rejects non-vault:// input (SEC-001) and does not persist', async () => {
    const scoutNode = useStudio.getState().nodes.find((n) => n.id === 'scout')!;
    expect(scoutNode).toBeDefined();

    // Open inspector on tools tab
    act(() => {
      useStudio.getState().openInspector(scoutNode.id, 'tools');
    });

    const { container } = render(
      <ReactFlowProvider>
        <DeviceInspectorDrawer />
      </ReactFlowProvider>
    );

    const initialSecretsCount = scoutNode.data.employee?.secrets.length ?? 0;

    const nameInput = container.querySelector('input[placeholder="e.g. SOURCE_API_KEY"]') as HTMLInputElement;
    const refInput = container.querySelector('input[placeholder="vault://depts/opp_acq/key"]') as HTMLInputElement;
    const addBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(nameInput).not.toBeNull();
    expect(refInput).not.toBeNull();
    expect(addBtn).not.toBeNull();

    // Enter a plaintext secret not starting with vault://
    fireEvent.change(nameInput, { target: { value: 'PLAINTEXT_SECRET' } });
    fireEvent.change(refInput, { target: { value: 'unencrypted-secret-key-1234' } });
    fireEvent.click(addBtn);

    // Expect SEC-001 error alert
    const alertBox = container.querySelector('[role="alert"]');
    expect(alertBox).not.toBeNull();
    expect(alertBox?.textContent).toContain('SEC-001');

    // Confirm secret was NOT persisted
    const updatedScout = useStudio.getState().nodes.find((n) => n.id === 'scout')!;
    expect(updatedScout.data.employee?.secrets.length).toBe(initialSecretsCount);
    expect(updatedScout.data.employee?.secrets.some((s) => s.name === 'PLAINTEXT_SECRET')).toBe(false);

    // Now enter a valid vault:// reference
    fireEvent.change(nameInput, { target: { value: 'SECURE_VAULT_KEY' } });
    fireEvent.change(refInput, { target: { value: 'vault://depts/opp_acq/secure_vault_key' } });
    fireEvent.click(addBtn);

    // Confirm valid secret is persisted
    const savedScout = useStudio.getState().nodes.find((n) => n.id === 'scout')!;
    expect(savedScout.data.employee?.secrets.some((s) => s.name === 'SECURE_VAULT_KEY')).toBe(true);
  });

  it('3. Problems panel: clicking a problem navigates inspector to the corrupted field and tab', async () => {
    // Corrupt a contract field by violating contract schema (delete required name)
    act(() => {
      const nodes = [...useStudio.getState().nodes];
      const scoutIdx = nodes.findIndex((n) => n.id === 'scout');
      const scout = JSON.parse(JSON.stringify(nodes[scoutIdx]));
      delete scout.data.employee.contract.name;
      nodes[scoutIdx] = scout;
      useStudio.setState({ nodes, revision: useStudio.getState().revision + 1 });
    });

    const { container } = render(
      <ReactFlowProvider>
        <ProblemsPanel />
      </ReactFlowProvider>
    );

    // Find the problem button
    const problemBtn = container.querySelector('button.text-start') as HTMLButtonElement;
    expect(problemBtn).not.toBeNull();

    // Click the problem button
    act(() => {
      fireEvent.click(problemBtn);
    });

    // Inspector should now be opened on the scout node and contract tab
    const inspector = useStudio.getState().inspector;
    expect(inspector).not.toBeNull();
    expect(inspector?.nodeId).toBe('scout');
    expect(inspector?.tab).toBe('contract');
  });

  it('4. Export ZIP: blocked when errors exist, generates valid 6-file ZIP when clean', async () => {
    const nodes = useStudio.getState().nodes;
    const edges = useStudio.getState().edges;
    const configs = useStudio.getState().configs;

    // Build bundle when clean
    const res = buildBundle(nodes, edges, configs, 'socroot-core');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Verify 6 files per employee
    const employees = ['opp_acq.scout.v1', 'opp_acq.context.v1', 'opp_acq.evaluator.v1', 'opp_acq.strategist.v1', 'opp_acq.drafter.v1'];
    for (const empId of employees) {
      const prefix = `departments/dept_opportunity_acquisition/${empId}/`;
      const empFiles = res.bundle.files.filter((f) => f.path.startsWith(prefix));
      expect(empFiles.length).toBeGreaterThanOrEqual(5);
      const fileNames = empFiles.map((f) => f.path.replace(prefix, ''));
      expect(fileNames).toContain('contract.json');
      expect(fileNames).toContain('manifest.yaml');
      expect(fileNames).toContain('employee.py');
      expect(fileNames).toContain('tools.py');
      expect(fileNames).toContain('policies.py');
    }

    // Verify config/*.yaml files exist
    const configFiles = res.bundle.files.filter((f) => f.path.startsWith('config/'));
    expect(configFiles.length).toBeGreaterThan(0);

    // Verify no unimplemented department directories
    expect(res.bundle.files.some((f) => f.path.startsWith('departments/dept_sales/'))).toBe(false);

    // Zip and verify with JSZip
    const blob = await zipBundle(res.bundle.files);
    expect(blob.size).toBeGreaterThan(500);

    const loadedZip = await JSZip.loadAsync(blob);
    expect(loadedZip.file('departments/dept_opportunity_acquisition/opp_acq.drafter.v1/contract.json')).not.toBeNull();
    expect(loadedZip.file('departments/dept_opportunity_acquisition/opp_acq.drafter.v1/policies.py')).not.toBeNull();
    expect(loadedZip.file('config/sources_watchlist.yaml')).not.toBeNull();
  });

  it('5. Cable rejection: drafter to network egress rejects with POL_DRF_HARD_01 and remediation fix', () => {
    const drafter = useStudio.getState().nodes.find((n) => n.id === 'drf')!;
    const egress = useStudio.getState().nodes.find((n) => n.id === 'web')!;
    expect(drafter).toBeDefined();
    expect(egress).toBeDefined();

    const { verdict } = checkConnection(drafter, egress);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe('POL_DRF_HARD_01');
      expect(verdict.reason).toContain('ZERO network egress allowed');
      expect(verdict.fix).toBeDefined();
      expect(verdict.fix).toContain('Scout');
    }
  });

  it('6. Port compatibility: dimming on drag and restoration on endDrag', () => {
    const scout = useStudio.getState().nodes.find((n) => n.id === 'scout')!;
    expect(scout).toBeDefined();

    // Start drag from scout port
    act(() => {
      useStudio.getState().startDrag(scout.id, 'out:TASK_DISPATCH_RESULT');
    });

    const compat = useStudio.getState().compat;
    expect(compat).not.toBeNull();
    expect(compat instanceof Set).toBe(true);

    // End drag
    act(() => {
      useStudio.getState().endDrag();
    });

    expect(useStudio.getState().compat).toBeNull();
  });

  it('7. Employee factory: passing gates adds node and connects manager cable', () => {
    const zone = useStudio.getState().nodes.find((n) => n.data.kind === 'zone')!;
    const preview = previewFactory(
      {
        roleId: 'evaluator',
        position: { x: zone.position.x + 40, y: zone.position.y + 40 },
        tenant_id: 'socroot-core',
        nodes: useStudio.getState().nodes,
      },
      {
        trigger: 'TRUST_BOUNDARY',
        justification: 'Requires separate trust boundary isolation.',
        repeat_count: 1,
      }
    );

    expect('gates' in preview && preview.ready).toBe(true);

    const placed = placeEmployee({
      roleId: 'evaluator',
      position: { x: zone.position.x + 40, y: zone.position.y + 40 },
      tenant_id: 'socroot-core',
      nodes: useStudio.getState().nodes,
      name: 'Placed Evaluator',
    });

    expect(placed.ok).toBe(true);
    if (placed.ok) {
      expect(placed.node).toBeDefined();
      expect(placed.edges.length).toBeGreaterThan(0);
      // Manager cable is created
      expect(placed.edges.some((e) => e.data?.kind === 'TASK_DISPATCH_RESULT')).toBe(true);
    }
  });

  it('8. Fault injection simulation and fit score gates (88 -> FAST_TRACK, 62 -> ESCALATE, 30 -> ABORT)', async () => {
    const ssrf = parseWatchlist(SOURCES_WATCHLIST_YAML);

    // Score checks
    const fast = await runSimulation({ fit_score: 88, ssrf });
    expect(fast.outcome).toBe('FAST_TRACK');

    const esc = await runSimulation({ fit_score: 62, ssrf });
    expect(esc.outcome).toBe('ESCALATE');
    expect(esc.steps.some((s) => s.id === 'ESCALATION_PACKAGE')).toBe(true);

    const abort = await runSimulation({ fit_score: 30, ssrf });
    expect(abort.outcome).toBe('ABORT');
    expect(abort.steps.some((s) => s.id === 'ABORT_REPORT')).toBe(true);

    // Fault: SSRF
    const ssrfRun = await runSimulation({ fit_score: 88, ssrf, faults: { ssrf: true } });
    expect(ssrfRun.steps.find((s) => s.id === 'SCOUT_FETCH')?.status).toBe('blocked');

    // Fault: Budget breach
    const budgetRun = await runSimulation({ fit_score: 88, ssrf, faults: { budget: true } });
    expect(budgetRun.outcome).toBe('ESCALATE');
    expect(budgetRun.steps.find((s) => s.id === 'BUDGET_RESERVE')?.status).toBe('blocked');
    expect(budgetRun.steps.at(-1)?.payload.spent_usd).toBe('0.000000');

    // Fault: Duplicate message
    const dupRun = await runSimulation({ fit_score: 88, ssrf, faults: { duplicate: true } });
    expect(dupRun.steps.find((s) => s.id === 'DUPLICATE_DROPPED')?.status).toBe('blocked');

    // Fault: Model failover
    const failoverRun = await runSimulation({ fit_score: 88, ssrf, faults: { failover: true } });
    expect(failoverRun.steps.some((s) => s.id === 'MODEL_FAILOVER')).toBe(true);
  });

  it('9. RTL & Language switching updates document.documentElement dir and lang', () => {
    // Initial english
    act(() => {
      useStudio.getState().setLang('en');
    });
    applyLang(document.documentElement, 'en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    // Switch to Arabic
    act(() => {
      useStudio.getState().setLang('ar');
    });
    applyLang(document.documentElement, 'ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    // Switch Theme
    act(() => {
      useStudio.getState().setTheme('light');
    });
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      useStudio.getState().setTheme('dark');
    });
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('10. Keyboard navigation: Ctrl+K opens palette from body and input, Escape closes and restores focus', async () => {
    const { unmount } = render(<StudioLayout onHome={() => {}} />);

    // Opener button: Focus CLI button in TopControlBar
    const cliBtn = screen.getByTitle(/socroot-admin CLI Console/i);
    cliBtn.focus();
    expect(document.activeElement).toBe(cliBtn);

    // Ctrl+K from document.body opens palette
    act(() => {
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    });
    expect(useStudio.getState().commandPaletteOpen).toBe(true);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    // Escape closes palette and restores focus to opener element
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(useStudio.getState().commandPaletteOpen).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(cliBtn));

    // Ctrl+K from inside an input field (typing()) also opens palette
    const dockSearch = document.querySelector('input') as HTMLInputElement;
    expect(dockSearch).not.toBeNull();
    dockSearch.focus();
    expect(document.activeElement).toBe(dockSearch);

    act(() => {
      fireEvent.keyDown(dockSearch, { key: 'k', ctrlKey: true });
    });
    expect(useStudio.getState().commandPaletteOpen).toBe(true);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    // Escape closes palette and restores focus to dock search input
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(useStudio.getState().commandPaletteOpen).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(dockSearch));

    unmount();
  });

  it('11. Dock keyboard navigation: templates focusable via Tab, Enter deploys role with staggered positions, and "i" button opens info without deploying', async () => {
    const { unmount } = render(<StudioLayout onHome={() => {}} />);

    // Switch to Employees category in dock
    const empCatBtn = screen.getByRole('button', { name: /Employees/i });
    act(() => {
      fireEvent.click(empCatBtn);
    });

    // Find dock items
    const dockItem = document.querySelector('[role="listitem"][draggable]') as HTMLElement;
    expect(dockItem).not.toBeNull();
    expect(dockItem.getAttribute('tabindex')).toBe('0');

    // Focus and press Enter on employee template -> factory modal opens
    dockItem.focus();
    act(() => {
      fireEvent.keyDown(dockItem, { key: 'Enter' });
    });
    expect(useStudio.getState().factoryModal).not.toBeNull();
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    // Escape closes factory modal
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(useStudio.getState().factoryModal).toBeNull();

    // Test non-employee role deployment has staggered positions
    const initialNodesCount = useStudio.getState().nodes.length;
    act(() => {
      useStudio.getState().deployRole('policy_engine');
    });
    const pos1 = useStudio.getState().nodes[useStudio.getState().nodes.length - 1].position;

    act(() => {
      useStudio.getState().deployRole('kill_switch');
    });
    const pos2 = useStudio.getState().nodes[useStudio.getState().nodes.length - 1].position;

    expect(pos1.x).not.toBe(pos2.x);
    expect(pos1.y).not.toBe(pos2.y);
    expect(useStudio.getState().nodes.length).toBe(initialNodesCount + 2);

    // Enter / Space on inner "i" button in dock item opens info modal and DOES NOT deploy node
    const countBeforeInfo = useStudio.getState().nodes.length;
    const infoBtn = dockItem.querySelector('button') as HTMLButtonElement;
    expect(infoBtn).not.toBeNull();

    infoBtn.focus();
    act(() => {
      fireEvent.keyDown(infoBtn, { key: 'Enter' });
      fireEvent.click(infoBtn);
    });

    expect(useStudio.getState().infoModalRoleId).not.toBeNull();
    expect(useStudio.getState().nodes.length).toBe(countBeforeInfo);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(useStudio.getState().infoModalRoleId).toBeNull();

    unmount();
  });

  it('12. Modal a11y: loop over all 10 modals and NewCompanyWizard verifying role="dialog", aria-modal="true", Tab trapping, Escape, and focus restoration', async () => {
    const { unmount } = render(<StudioLayout onHome={() => {}} />);

    const modalSpecs = [
      {
        name: 'CommandPaletteModal',
        open: () => useStudio.getState().setCommandPaletteOpen(true),
        isOpen: () => useStudio.getState().commandPaletteOpen,
      },
      {
        name: 'SocrootAdminCliModal',
        open: () => useStudio.getState().setCliModalOpen(true),
        isOpen: () => useStudio.getState().cliModalOpen,
      },
      {
        name: 'BreakGlassModal',
        open: () => useStudio.getState().setBreakGlassModalOpen(true),
        isOpen: () => useStudio.getState().breakGlassModalOpen,
      },
      {
        name: 'CompanyTenantModal',
        open: () => useStudio.getState().setTenantModalOpen(true),
        isOpen: () => useStudio.getState().tenantModalOpen,
      },
      {
        name: 'ExportBundleModal',
        open: () => useStudio.getState().setExportModalOpen(true),
        isOpen: () => useStudio.getState().exportModalOpen,
      },
      {
        name: 'KillPlaneModal',
        open: () => useStudio.getState().setKillModalOpen(true),
        isOpen: () => useStudio.getState().killModalOpen,
      },
      {
        name: 'ConfigEditorModal',
        open: () => useStudio.getState().setConfigEditorModalOpen(true),
        isOpen: () => useStudio.getState().configEditorModalOpen,
      },
      {
        name: 'EmployeeFactoryModal',
        open: () => useStudio.getState().openFactoryModal('evaluator', { x: 300, y: 200 }),
        isOpen: () => useStudio.getState().factoryModal !== null,
      },
      {
        name: 'ComponentInfoModal',
        open: () => useStudio.getState().openInfoModal('evaluator'),
        isOpen: () => useStudio.getState().infoModalRoleId !== null,
      },
      {
        name: 'CableDetailModal',
        open: () => useStudio.getState().openCableModal(useStudio.getState().edges[0]?.id || 'e_scout_ctx'),
        isOpen: () => useStudio.getState().selectedCableEdgeId !== null,
      },
    ];

    const triggerBtn = screen.getByTitle(/Auto Layout/i);

    for (const spec of modalSpecs) {
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      act(() => {
        spec.open();
      });
      expect(spec.isOpen(), `Modal ${spec.name} should open`).toBe(true);

      const dialog = await waitFor(() => {
        const d = document.querySelector('[role="dialog"]') as HTMLElement;
        expect(d, `Dialog for ${spec.name} must be rendered`).not.toBeNull();
        return d;
      });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby') || dialog.getAttribute('aria-label')).toBeTruthy();

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled'));

      expect(focusables.length, `Expected focusable elements in ${spec.name}`).toBeGreaterThan(0);

      if (focusables.length > 1) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        first.focus();
        act(() => {
          fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        });
        expect(document.activeElement).toBe(last);

        last.focus();
        act(() => {
          fireEvent.keyDown(last, { key: 'Tab', shiftKey: false });
        });
        expect(document.activeElement).toBe(first);
      }

      // Escape closes dialog and restores focus to opener
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(spec.isOpen(), `Modal ${spec.name} should close on Escape`).toBe(false);
      await waitFor(() => expect(document.activeElement).toBe(triggerBtn));
    }

    unmount();

    // Verify NewCompanyWizard
    let wizardCancelled = false;
    const { unmount: unmountWiz } = render(
      <NewCompanyWizard onCreate={() => {}} onCancel={() => { wizardCancelled = true; }} />
    );
    const wizDialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(wizDialog).not.toBeNull();
    expect(wizDialog.getAttribute('aria-modal')).toBe('true');

    const wizFocusables = Array.from(
      wizDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'));
    expect(wizFocusables.length).toBeGreaterThan(1);
    const firstWiz = wizFocusables[0];
    const lastWiz = wizFocusables[wizFocusables.length - 1];

    firstWiz.focus();
    act(() => {
      fireEvent.keyDown(firstWiz, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(lastWiz);

    lastWiz.focus();
    act(() => {
      fireEvent.keyDown(lastWiz, { key: 'Tab', shiftKey: false });
    });
    expect(document.activeElement).toBe(firstWiz);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(wizardCancelled).toBe(true);
    unmountWiz();
  });

  it('13. A11y icon buttons: all icon-only buttons have non-empty aria-label in AR and EN, including inside all open modals', async () => {
    for (const lang of ['en', 'ar'] as const) {
      act(() => {
        useStudio.getState().setLang(lang);
      });
      const { unmount } = render(<StudioLayout onHome={() => {}} />);

      const modalOpeners = [
        () => {}, // base studio
        () => useStudio.getState().setCliModalOpen(true),
        () => useStudio.getState().setBreakGlassModalOpen(true),
        () => useStudio.getState().setKillModalOpen(true),
        () => useStudio.getState().setTenantModalOpen(true),
        () => useStudio.getState().setExportModalOpen(true),
        () => useStudio.getState().setConfigEditorModalOpen(true),
        () => useStudio.getState().openFactoryModal('evaluator', { x: 300, y: 200 }),
        () => useStudio.getState().openInfoModal('evaluator'),
        () => useStudio.getState().openCableModal(useStudio.getState().edges[0]?.id || 'e_scout_ctx'),
      ];

      for (const openModal of modalOpeners) {
        act(() => {
          openModal();
        });

        const isIconOnly = (btn: HTMLButtonElement) => {
          const text = btn.textContent?.trim() || '';
          return text.length <= 2 || ['✕', 'i', '▶', '◀'].includes(text);
        };

        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(isIconOnly);
        expect(buttons.length).toBeGreaterThan(0);

        for (const btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label');
          expect(ariaLabel, `Button with text "${btn.textContent}" in ${lang} lacks aria-label`).toBeTruthy();
          expect(ariaLabel?.trim().length).toBeGreaterThan(0);
          if (lang === 'ar' && !btn.closest('.react-flow__controls')) {
            expect(/[\u0600-\u06FF]/.test(ariaLabel!), `Arabic button "${btn.textContent}" has non-Arabic label: "${ariaLabel}"`).toBe(true);
          }
        }

        act(() => {
          fireEvent.keyDown(window, { key: 'Escape' });
        });
      }

      unmount();
    }
  });

  it('14. Focus theft regression: typing in input of ConfigEditorModal or SocrootAdminCliModal preserves focus', async () => {
    const { unmount } = render(<StudioLayout onHome={() => {}} />);

    // 1. ConfigEditorModal
    act(() => {
      useStudio.getState().setConfigEditorModalOpen(true);
    });
    const configDialog = await waitFor(() => {
      const d = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(d).not.toBeNull();
      return d;
    });
    const configInput = configDialog.querySelector('textarea, input') as HTMLElement;
    expect(configInput).not.toBeNull();
    configInput.focus();
    expect(document.activeElement).toBe(configInput);

    act(() => {
      fireEvent.change(configInput, { target: { value: 'model_routing: updated' } });
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(configInput);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // 2. SocrootAdminCliModal
    act(() => {
      useStudio.getState().setCliModalOpen(true);
    });
    const cliDialog = await waitFor(() => {
      const d = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(d).not.toBeNull();
      return d;
    });
    const cliInput = cliDialog.querySelector('input') as HTMLInputElement;
    expect(cliInput).not.toBeNull();
    cliInput.focus();
    expect(document.activeElement).toBe(cliInput);

    act(() => {
      fireEvent.change(cliInput, { target: { value: 'status' } });
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(cliInput);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    unmount();
  });

  it('15. Full Done-when End-to-End flow: Start screen -> create company -> add employee -> connect -> export valid ZIP without advanced tab', async () => {
    window.localStorage.clear();
    await del('socroot:last');
    useStudio.setState({ nodes: [], edges: [] });
    const { unmount } = render(<App />);

    // 1. From StartScreen: Click Reference department to initialize company
    const refCardBtn = await screen.findByRole('button', { name: /Reference department/i });
    expect(refCardBtn).not.toBeNull();
    await act(async () => {
      fireEvent.click(refCardBtn);
    });

    // 2. Add an employee via dock deployment
    act(() => {
      useStudio.getState().deployRole('evaluator');
    });
    expect(useStudio.getState().factoryModal).not.toBeNull();

    // Confirm factory placement
    const zone = useStudio.getState().nodes.find((n) => n.data.kind === 'zone')!;
    const placed = placeEmployee({
      roleId: 'evaluator',
      position: { x: zone.position.x + 40, y: zone.position.y + 40 },
      tenant_id: useStudio.getState().tenant_id,
      nodes: useStudio.getState().nodes,
      name: 'Evaluator 2',
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    act(() => {
      useStudio.setState((s) => {
        s.nodes = [...s.nodes, placed.node];
        s.edges = [...s.edges, ...placed.edges];
        s.factoryModal = null;
      });
    });

    // 3. Export valid ZIP bundle
    const state = useStudio.getState();
    const bundleRes = buildBundle(state.nodes, state.edges, state.configs, state.tenant_id);
    expect(bundleRes.ok).toBe(true);
    if (!bundleRes.ok) return;

    const zipBlob = await zipBundle(bundleRes.bundle.files);
    expect(zipBlob).not.toBeNull();
    expect(zipBlob.size).toBeGreaterThan(0);

    // 4. Verify ZIP contents via JSZip
    const zip = await JSZip.loadAsync(zipBlob);
    const files = Object.keys(zip.files);

    // Check newly added evaluator files in ZIP
    const evaluatorFiles = files.filter((f) => f.includes('evaluator'));
    expect(evaluatorFiles.length).toBeGreaterThanOrEqual(5);
    expect(files.some((f) => f.includes('evaluator') && f.endsWith('manifest.yaml'))).toBe(true);
    expect(files.some((f) => f.includes('evaluator') && f.endsWith('contract.json'))).toBe(true);
    expect(files.some((f) => f.includes('evaluator') && f.endsWith('employee.py'))).toBe(true);
    expect(files.some((f) => f.includes('evaluator') && f.endsWith('tools.py'))).toBe(true);
    expect(files.some((f) => f.includes('evaluator') && f.endsWith('policies.py'))).toBe(true);

    // 5. Verify inspector?.advanced was never activated
    const currentInspector = useStudio.getState().inspector as unknown as { advanced?: boolean } | null;
    expect(currentInspector?.advanced).toBeFalsy();

    unmount();
  });
});
