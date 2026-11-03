# What this archive contains

Reflects the work done in the external workspace that had not been copied into the first archive, on top of the original archive's
build tooling (Vite, Tailwind, Vitest) and canvas.

Brought in from the external workspace (engine layer rebuilt against MASTER_REFERENCE_v1.1.md):
- `src/schemas/*.schema.json`: the six schemas extracted verbatim from §2.2, plus `validator.ts` (Ajv 2020, errors mapped to fields) and `project.ts`.
- `src/types/`: statuses/horizons, the three state machines, governance types, project file.
- `src/registry/`: role definitions as data (13 roles of §6.3.2 + founder + orchestrator, memory tiers, guards, zones), typed ports, cable rules, horizons, scenarios.
- `src/engine/`: policyEngine (5 tiers), permissionStore (fnmatch, RBAC), ssrfGuard, budgetGuard + pricingCalculator, killSwitchManager, ed25519Verifier,
  auditLogger (reference hash format), scoringEngine, contextBuilder, secretGuard, cablingValidator, employeeFactory, generators (six files, locked PEP),
  qualityGates, problems.
- `src/presets/`: reference configs copied verbatim from the reference, tenant profiles.

Written to connect it to the existing app (new in this archive):
- `src/presets/referenceTopology.ts` rebuilt on the registry; `src/store/useStudioStore.ts`; `src/App.tsx` (typed ports, port dimming while dragging,
  Problems panel, horizon switch, EN/AR toggle with RTL, scenario buttons, audit chain with Verify and Tamper); `tests/*.test.ts` (69 tests).

Not built yet (not present in either workspace): simulation runner with per-step explanations and fault injection, inspector drawer with live Ajv editing,
Employee Factory wizard, socroot-admin / Break-Glass / tenant / export modals, ZIP exporter, project persistence and migrations, Undo/Redo,
start screen and wizard, command palette, performance test with 300 nodes.
Drafts of simulationRunner, bundleExporter, breakGlass, adminCli, builders and templates were written in the external workspace before it was reset;
they targeted the earlier, unreconciled schemas and were not carried over.


# Batch 2 (this archive)

Added (pure, no UI unless stated):
- `src/persistence/`: `migrations.ts` (version hops, `MigrationError`), `projectIO.ts` (JSON -> migrate -> Ajv, export strips runtime fields), `projectStore.ts` (several projects in IndexedDB via `idb-keyval`), `autosave.ts` (debounced saver).
- `src/i18n/`: `en.ts` (source), `ar.ts` (must have the same keys, enforced by types and a test), `index.ts` (`t`, `dirOf`, `applyLang`), `useT.ts` (React hook).
- `src/store/`: `history.ts` (Undo/Redo snapshots), `graphOps.ts` (copy/paste/duplicate/delete with descendants), `useStudioStore.ts` rewritten on Zustand + immer: Undo/Redo, copy/paste/duplicate/delete, select all, `mode`, `theme`, `tenant`, `configs`, project meta, `revision` counter for autosave, `loadProject`/`toProject`.
- `src/engine/simulationRunner.ts`: deterministic run with per-step bilingual explanations and the four fault switches (see G-10).
- `src/components/layout/useShortcuts.ts`: Ctrl/Cmd+Z, Y, C, V, D, A and Delete.
- `src/App.tsx`: one selector per store field (a node drag no longer re-renders the shell), shortcuts, Undo/Redo buttons, `deleteKeyCode={null}` (the store owns deletion), text through `t()`, `lang`/`dir` applied to `<html>`.
- Tests: `history`, `persistence`, `projectStore`, `i18n`, `simulation`.

Verification status (be careful): the sandbox had no network, so `npm ci`, `npm run build` and `npm test` were NOT run on this archive.
The five new test files were run (28/28) in a scratch harness with stand-ins for `vitest`, `js-yaml` (real YAML via Python), `idb-keyval` (in-memory) and the Ajv validator, and the pure modules passed a strict `tsc` check.
So NOT verified: the real Ajv path of `parseProjectText`, the real IndexedDB path, `useStudioStore.ts`, `App.tsx` and `useT.ts` (syntax-checked only), and the earlier 69 tests. Run `npm ci && npm run build && npm test` first and send me any errors.

Still not built: start screen and wizard, `TopControlBar`/`StatusBar` components, inspector drawer, simulation panel UI (play/step/stop/reset, fault switches), Employee Factory UI, admin CLI and Break-Glass (G-12), tenant and export modals, `bundleExporter`, autosave wiring in the app, context menu, command palette, alignment, light theme styling (the `theme` state exists but no light styles do), architecture and 300-node performance tests, `src/components/**` split of `App.tsx`.

# Batch 3 (this archive) — external-workspace work now reflected

Replayed from the external workspace log (files copied as written there):
- `src/engine/bundleExporter.ts` (`planBundle`, `buildBundle`: `departments/<dept>/<employee_id>/{six files}` + `config/*.yaml`, ORG-003 skips non-IMPLEMENTED departments, any Problems error blocks export), `src/engine/zipBundle.ts` (jszip, lazy), `src/engine/simPlayer.ts` (play/step/stop/reset reducer).
- `src/presets/startTemplates.ts`: start cards (reference, RLS, TEN-004, blank) and the pure `createProject` used by the 3-step wizard.
- `src/store/problemsMemo.ts`, `useProblems.ts`, `projectActions.ts`: one shared Problems list (cached while only positions change), open/import helpers.
- Components split out of `App.tsx`: `canvas/{TopologyCanvas,nodeTypes,nodes/StudioNode,nodes/ZoneNode,edges/ProtocolEdge}`, `layout/{Dock,TopControlBar,StatusBar,ErrorBoundary,useAutosave}`, `problems/ProblemsPanel`, `simulation/{PduSimulationPanel,AuditChainViewer}`.
- i18n: about 45 new keys in `en.ts`/`ar.ts` (top bar, export, simulation, start screen, wizard, error boundary).
- Tests: `tests/exporter.test.ts` (exporter, ORG-003, templates/wizard, player).

Written in this batch because the log ended before them (the log's last batch built the panels but not these):
- `components/onboarding/StartScreen.tsx`, `components/onboarding/NewCompanyWizard.tsx`, `components/layout/StudioLayout.tsx`, and a new small `App.tsx` that restores the last saved company on reload or shows the start screen.
- `tests/problemsMemo.test.ts`.

Verification status (be careful): no network in the sandbox, so `npm ci`, `npm run build`, `npm test` were NOT run.
Run in a scratch harness (stand-ins for vitest, js-yaml via Python, Ajv validator): exporter 8/8, simulation 11/11, topology 11/11, problemsMemo 1/1, policy 20/21 (the one miss is a missing `toThrow` in my stand-in, not in the code).
`tsc` with the real libraries absent showed no errors other than those caused by the missing libraries.
NOT verified: any React component at runtime, the real Ajv/IndexedDB/React Flow paths, `guards.test.ts` (needs @noble/ed25519).

Still not built: inspector drawer (6 tabs, live editing), Employee Factory wizard modal, socroot-admin / Break-Glass / tenant modals, export modal (export is a top-bar button for now),
command palette (Ctrl+K), context menu, auto-layout/align, the 300-node render test, light theme.
Drafts of breakGlass, adminCli, builders and templates from the external workspace were lost before the log and are not recoverable from it.

## Sync 2: files recovered from the external workspace (v4)
Added to `src/engine/` (pure, no React): `adminCli.ts` (socroot-admin tree, assistant never executes, CONFIRM required), `breakGlass.ts` (session-only Ed25519 key, TTL <= 900 s, single-use nonce),
`factoryPlacement.ts` (department/manager resolution, next free employee id, factory preview and placement), `inspectorEdit.ts` (pure inspector edits that return an Edit result), `layout.ts` (align, distribute, auto layout).
Fixed: `src/schemas/project.ts` failed Ajv strict mode (`strictRequired`) because `data` and edge `data` listed required keys without declaring them; this broke project import and export.
Tests: `tests/engines2.test.ts` covers break-glass, the CLI and layout. Not yet covered: `factoryPlacement.ts` and `inspectorEdit.ts` (no UI uses them yet).

# Batch 4 (Final Production Alignment & Verification)
1. **Canonical Alignment with MASTER_REFERENCE_v1.1.md:**
   - **G-10 (§3.1.3):** Updated `src/engine/simulationRunner.ts` to implement the Lifecycle Loop aligned with §3.1.3 (Step 1 Receive & Validate, Step 2 Decompose Plan, Step 3 Budget Reserve, Steps 4+5 Dispatch, Model Call & Early Abort Gate in unified loop, Step 6 Validate Output & SLA for final task result, Step 7 Founder Escalation, Step 8 State Driver Optimistic Update, Step 9 SHA-256 Audit Chain & Budget Reconcile). `PduSimulationPanel` displays `§3.1.3 · Step N` or `§3.1.3 · Steps 4+5` (`الخطوتان 4+5`).
   - **G-03 (§4.2.1, §6.3.2):** Verified roles 1–5 and 13 (manager) explicitly matching reference permissions (`source: 'reference'`). Roles 6–12 maintained derived under least privilege with `source: 'derived'` conforming to security constraints.
   - **G-05 (§3.3.1):** Verified band 40.0–49.9 is unspecified in reference; maintained fail-closed `ESCALATE` with `POL_EVA_UNSPECIFIED_BAND`.
   - **G-07 & G-08 (§6.9.1, Diagram 11):** Verified three orthogonal state machines (Lifecycle, Deployment, Autonomy) matching reference transitions verbatim.
   - Updated `docs/REFERENCE_GAPS.md` with all resolution details.
2. **UI Integration Tests in JSDOM (`tests/ui.test.tsx`):**
   - Configured `ResizeObserver`, `DOMMatrixReadOnly`, and `matchMedia` polyfills in `tests/setup.ts`.
   - Built 9 integration tests covering all critical paths: StartScreen template opening & button visibility, SEC-001 `vault://` secret reference enforcement and rejection of plaintext, Problems panel jump-to-field, valid ZIP generation with 6 files/employee + config/*.yaml (and rejection when errors exist), cable rejection with `POL_DRF_HARD_01` and readable remediation, port compatibility dimming, factory intake quality gates, simulation fault injections, and dynamic RTL/dir/lang/theme switching on `document.documentElement`.
3. **Performance Test Hardening (`tests/performance.test.tsx`):**
   - 300 nodes rendered with Profiler render-pass tracking. Moving a single node proves that other 299 nodes do not re-render, verifying `React.memo` and selective Zustand store subscriptions.
4. **Bundle Splitting (`vite.config.ts`):**
   - Configured `output.manualChunks` splitting into `vendor-xyflow`, `vendor-react`, `vendor-validation`, `vendor-codemirror`, `vendor-lucide`.
   - Zero initial chunks > 500 KB (largest JS chunk ~431 KB, index chunk ~327 KB).
5. **Clean Verification:**
   - All 15 test files passed (138 tests passed).
   - `tsc --noEmit` cleanly passed with 0 errors.
   - `compile_applet` confirmed successful compilation.


# Batch 5 (Traceability, Complete Localization & UX Optimization)

1. **Master Reference Location & Artifact Cleanup:**
   - Moved `MASTER_REFERENCE_v1.1_fea52b40.md` to project root (`MASTER_REFERENCE_v1.1_fea52b40.md`).
   - Removed old obsolete zip archive (`socroot-topology-studio_updated_v4_98a4afce.zip`) from `public/assets/aistudio/`.
   - Created `scripts/build-reference-index.mjs` to parse and index 149 sections into `src/registry/referenceIndex.generated.json`.

2. **Complete Engine Traceability & Wiring:**
   - Wrote `docs/TRACEABILITY.md` documenting bidirectional mapping for all 25 engine modules across reference § sections, UI entry points, and test suites.
   - Built `tests/wiring.test.ts` verifying all 25 engine modules and their connections.
   - Connected `engine/contextBuilder.ts` to `ContextTab.tsx` in `DeviceInspectorDrawer.tsx` (viewing the 6 prompt layers §5.2.2 and TEN-003 multitenant isolation filter).
   - Connected `calculateFitScore` (§3.3.1 & §3.3.2) in `PduSimulationPanel.tsx` via an interactive criteria rubric formula.
   - Connected `pricingCalculator` (`parsePricing`, `costUsd`) in `PduSimulationPanel.tsx` to calculate step 5 model call costs in micro-USD.
   - Built `ConfigEditorModal.tsx` for live editing and Ajv/schema validation of `model_routing.yaml`, `sources_watchlist.yaml`, and `pricing_config.yaml`.
   - Enforced `architecture_horizon` on canvas nodes (`StudioNode.tsx`) via dimming and dashed borders when beyond the current active horizon.
   - Replaced exclusive simulation replacement in `StudioLayout.tsx` with dockable tabs (`Problems` | `Simulation`), ensuring problem count and details remain accessible at all times.

3. **Complete Arabic Localization & Logical Styling:**
   - Created engine messages catalog under `src/i18n/messages/` (`cabling.ts`, `cli.ts`, `policy.ts`, `breakGlass.ts`, `index.ts`) translating engine codes to Arabic.
   - Translated all 15 commands and categories in `CommandPaletteModal.tsx`.
   - Localized all buttons, titles, and tooltips in `TopControlBar.tsx`.
   - Replaced all physical CSS classes (`mr-*`, `pl-*`) with logical CSS utilities (`me-*`, `ps-*`).
   - Replaced fragile CSS class overrides in `src/index.css` with semantic CSS tokens (`:root` and `html.light`) and local Arabic font stack without CDN.
   - Persisted `lang`, `theme`, and panel preferences in `localStorage` and synchronized `index.html` via an inline bootstrap script.
   - Created `tests/arabicCompleteness.test.tsx` verifying dictionary parity, engine translations, and RTL layout.

4. **UX Improvements (Cables, Nodes, MiniMap):**
   - **ProtocolEdge:** Added `EdgeLabelRenderer` with badge (color + icon + short name), clickable portal opening `CableDetailModal.tsx` (description, endpoints, schema, permissions, validity, and delete/inspect actions).
   - **Simulation Canvas:** Animated glowing pulse on active actor node and active communication cable during step-by-step simulation.
   - **Component Info:** Added "i" info icon on `StudioNode`, `Dock` items, and inspector drawer header opening `ComponentInfoModal.tsx` with bilingual architectural `help`, ref, horizon, ports, permissions, and SSOT excerpt.
   - **Interactive MiniMap:** Kind-based node coloring, red error indicators from `useProblems`, transparent zone boundaries, active actor amber highlight, view fit/focus controls, and interactive cable legend.

# Batch 6 (Production Finalization, §3.1.3 Canonical Alignment, A11y & QA)

1. **§3.1.3 Simulation Lifecycle Alignment:**
   - Unified Steps 4 and 5 into a single iterative loop `4+5` (`الخطوتان 4+5`) for each participant employee in `src/engine/simulationRunner.ts` (Emergency Circuit Breaker check -> Dispatch & Monitor -> Abort Gate when Evaluator `fit_score < 40.0` -> return `_build_abort_result` immediately).
   - Early abort at `fit_score < 40.0` halts execution immediately after the unified loop with an `ABORT_REPORT`, skipping steps 6 through 9 entirely as strictly specified in §3.1.3 lines 1345–1402.
   - Assigned step `6` exclusively to final task output & SLA verification (`TASK_RESULT`).
   - Steps 8 and 9 execute only for non-aborted paths (State Driver update, SHA-256 audit chaining & budget reconciliation).
   - Updated `PduSimulationPanel.tsx` labels and badges to display `الخطوتان 4+5: ...` / `Steps 4+5: ...`.

2. **Strict TypeScript Typing (Zero Unjustified `any`):**
   - Eliminated `any` in `src/components/canvas/TopologyCanvas.tsx` for MiniMap and node rendering, properly typing with `SNode` and typed event handlers.

3. **Comprehensive Modal Accessibility & Keyboard Navigation:**
   - Created `src/components/modals/useModalA11y.ts` implementing window-level focus trapping inside active modals, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape key dismissing only the topmost modal on the stack with focus restoration to the opener element.
   - Applied `useModalA11y` across all 10 modal dialogs and `NewCompanyWizard.tsx`: `BreakGlassModal`, `CompanyTenantModal`, `EmployeeFactoryModal`, `ExportBundleModal`, `KillPlaneModal`, `SocrootAdminCliModal`, `CommandPaletteModal`, `CableDetailModal`, `ComponentInfoModal`, `ConfigEditorModal`.
   - Enabled keyboard navigation in `src/components/layout/Dock.tsx`: dock role templates are focusable via `Tab` with visible focus rings (`focus-visible:ring-2 ring-indigo-500`), and pressing `Enter` or `Space` deploys the role or opens the factory modal.
   - Added descriptive localized `aria-label`s to all icon-only buttons across `StudioLayout.tsx`, `TopologyCanvas.tsx`, `TopControlBar.tsx`, `PoliciesTab.tsx`, `StudioNode.tsx`, and `DeviceInspectorDrawer.tsx`.
   - Added 4 comprehensive UI integration tests in `tests/ui.test.tsx` (tests 10, 11, 12, 13) covering keyboard navigation (Ctrl+K, Esc, focus restoration), dock navigation via Tab and Enter/Space, modal focus trapping & ARIA attributes, and icon button aria-labels in Arabic and English.

4. **AI Studio Artifact Cleanup:**
   - Removed `metadata.json` and `.env.example`.
   - Updated `.gitignore` to prevent any environment or metadata leaks.

5. **Quality Assurance Documentation:**
   - Created `docs/QA_CHECKLIST.md` in Arabic containing structured manual/visual test cases covering dock interaction, cable validation, secret references, simulation scenarios, state persistence, theming, RTL, and bundle export, with clear disclaimers on automated testing vs real browser rendering.

6. **Test Suite Milestone:**
   - 161 automated tests passing across 17 test suites (100% pass rate).

# Batch 7 (Keyboard A11y Bugfixes, Focus Theft Prevention, Architecture Guards & Reality-Grounded QA)

1. **useModalA11y Focus Theft & Selector Fixes:**
   - Decoupled `onClose` using `onCloseRef` and narrowed effect dependencies to `[isOpen, trapFocus]`, eliminating focus stealing on keystrokes caused by inline `onClose` recreation on modal re-renders.
   - Guarded focus movement to only fire on fresh open transitions, preventing focus from being redirected away from active inputs.
   - Updated `FOCUSABLE_SELECTOR` to explicitly exclude `input[type="hidden"]`, `[hidden]`, and `[aria-hidden="true"]` via attribute selectors without relying on `offsetParent`.
   - Removed `{ trapFocus: false }` exceptions in `NewCompanyWizard.tsx` and `CommandPaletteModal.tsx`, enforcing focus trapping consistently across all modals.

2. **Dock UX & Keyboard Navigation Refinements:**
   - Added `e.target === e.currentTarget` guard in `src/components/layout/Dock.tsx` card `onKeyDown`, stopping bubbling events from the inner `i` button from deploying a role.
   - Added `role="list"` to the dock items container and `role="listitem"` with descriptive `aria-label` to each template card without invalid interactive role nesting.
   - Implemented staggered coordinates calculation inside viewport for keyboard-deployed roles in `src/store/useStudioStore.ts:deployRole`, preventing nodes from stacking on the same coordinates.

3. **Architecture Guards & End-to-End Test Suite:**
   - Created `tests/architectureGuards.test.ts` verifying: zero `TODO`/`FIXME` in code/tests/scripts, zero external CDN scripts or stylesheet links, zero unjustified `any` types, zero UI library value imports or DOM globals in `src/engine/**`, and zero AI Studio remnant files.
   - Added full Done-when end-to-end integration test in `tests/ui.test.tsx` verifying company initialization, employee factory placement, manager connection, and production ZIP generation verified with `JSZip` without opening advanced tabs.
   - Strengthened UI tests (10 to 14) covering `Ctrl+K` from body and inputs, focus theft prevention during typing, dock template and info button navigation, and complete modal loop over all 10 modals + wizard.
   - Replaced all instances of `expect(querySelector(...)).toBeDefined()` with strict `expect(...).not.toBeNull()`.

4. **Realistic QA Checklist & Cleanup:**
   - Rewrote `docs/QA_CHECKLIST.md` into a concise 21-row table directly matching the actual UI components, 7 inspector tabs (`identity`, `contract`, `manifest`, `code`, `tools`, `policies`, `context`), port compatibility dimming (`compat`), blocked export button (`export.blocked`), and actual pricing (§6.1.2).
   - Removed dead `outcome === 'ABORT'` branch in `simulationRunner.ts:finish()`.
   - Cleaned redundant Arabic abort title in `simulationRunner.ts:376`.
   - Cleaned unused imports and selectors (`getRole`, `addRole`, `openFactoryModal`) in `TopologyCanvas.tsx`.

5. **Test Suite Milestone:**
   - 168 automated tests passing across 18 test suites (100% pass rate).


# Batch 8 (UX & Guidance Deepening for Non-Programmers)

1. **Feedback & Toasts Layer:**
   - Created `Toasts.tsx` with an `aria-live="polite"` region, auto-dismiss, pause-on-hover, and optional action buttons.
   - Integrated notification store slice (`notify`, `dismissToast`, `toasts`) used for autosave/manual save, import/export success, cable rejections, duplicate actions, and node deletions with 1-click Undo recovery.

2. **Safe Actions & Confirmation Dialogs:**
   - Built reusable `ConfirmDialog.tsx` with focus trapping and accessible ARIA attributes.
   - Enforced confirmation for deleting saved companies on `StartScreen.tsx`, deleting connected canvas components (showing component and connected cable counts), and engaging emergency kill switches in `KillPlaneModal.tsx`.

3. **Guidance & Onboarding:**
   - Created 5-step `GuidedTour.tsx` (Dock, Canvas, Cabling, Inspector, Simulation) shown on first run and persisted in IndexedDB (`socroot:tour_seen`).
   - Created `HelpSheet.tsx` (opened via `?` or top-bar button) displaying keyboard shortcuts from canonical `SHORTCUTS_TABLE`, cable color & dash pattern legend, and SOCROOT architecture glossary.
   - Added empty-canvas hint banner with "Deploy Starter Department" primary action.
   - Added interactive "next step" guidance line to `StatusBar.tsx`.

4. **Top Bar & Canvas Ergonomics:**
   - Refactored `TopControlBar.tsx` into 5 distinct control clusters (Project, Edit, Layout, Operations, View) with responsive `useContainerWidth` hook hiding secondary controls in "More ▾" dropdown on narrow viewports while keeping Kill Plane visually prominent.
   - Added snap-to-grid toggle (16px), dim-unrelated-nodes toggle, and reduced-motion toggle (`prefers-reduced-motion` compliance) saved in user preferences.
   - Added floating selection toolbar for alignment (2+ selected nodes) and horizontal/vertical distribution (3+ selected nodes).
   - Double-clicking empty canvas opens command palette in add-component mode.

5. **Simulation & Inspector Ergonomics:**
   - Added step back (`⏮`), speed selector (0.5×, 1×, 2×), scrubbable timeline slider, Space/Arrow key keyboard navigation, pinned step explanation box, and final Execution Summary card in `PduSimulationPanel.tsx`.
   - Made side panel resizable with width memory in `localStorage` and auto-collapse below 1100 px.
   - Added problem-count badges to Device Inspector tabs (`Identity`, `Contract`, `Manifest`, `Code`, `Tools`, `Policies`, `Context`).

6. **Documentation & Testing:**
   - Created `docs/UX_TASKS.md` defining 6 real-world tasks and pass criteria for non-programmers.
   - Created `tests/uxErgonomics.test.tsx` testing toasts, confirmation dialogs, tour persistence, shortcuts parity, and simulation controls.
   - Total test suite: 175 tests across 19 test files passing 100%.
