# SOCROOT Topology Studio — Engine Traceability & Architecture Mapping

This document provides complete, bidirectional traceability between the 25 pure engine modules in `src/engine/*`, their grounding in `MASTER_REFERENCE_v1.1_fea52b40.md`, their UI entry points in `src/components/*`, and their verification tests in `tests/*`.

---

## 1. Engine Module Traceability Matrix

| # | Engine Module (`src/engine/*`) | Reference Section | Key Functions / Exports | UI Entry Point (`src/components/*`) | Test Suite (`tests/*`) |
|---|---|---|---|---|---|
| 1 | `adminCli.ts` | §3.5 (OPS-001..OPS-003) | `COMMAND_TREE`, `parseCommand`, `executeCommand`, `advisoryPlan` | `SocrootAdminCliModal.tsx`, `CommandPaletteModal.tsx`, `TopControlBar.tsx` | `engines2.test.ts`, `wiring.test.ts` |
| 2 | `auditLogger.ts` | §4.6.2, §3.1.3 (AUD-001) | `AuditLogger`, `verify`, `log` (SHA-256 links) | `AuditChainViewer.tsx`, `PduSimulationPanel.tsx`, `StatusBar.tsx` | `engines2.test.ts`, `simulation.test.ts`, `wiring.test.ts` |
| 3 | `breakGlass.ts` | §4.5 (IAM-001..IAM-003) | `openSession`, `tokenSummary`, `BG_SCOPES` | `BreakGlassModal.tsx`, `TopControlBar.tsx` | `engines2.test.ts`, `wiring.test.ts` |
| 4 | `budgetGuard.ts` | §6.1, §3.1.3 (FIN-001) | `checkBudget`, `reserveBudget`, `reconcileBudget` | `PduSimulationPanel.tsx` (Step 3 & 9), `CompanyTenantModal.tsx` | `policy.test.ts`, `guards.test.ts`, `wiring.test.ts` |
| 5 | `bundleExporter.ts` | §2.1, §6.3, §1.4.3 (ORG-003) | `planBundle`, `buildBundle` (6-file anatomy) | `ExportBundleModal.tsx`, `TopControlBar.tsx` | `exporter.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 6 | `cablingValidator.ts` | §3.2, §4.3 (POL_DRF_HARD_01) | `checkConnection`, `validateGraphCables` | `TopologyCanvas.tsx` (drag/connect/rejection), `CableDetailModal.tsx` | `topology.test.ts`, `guards.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 7 | `contextBuilder.ts` | §5.2.2 (6 Layers), §5.7.3 (TEN-003) | `buildLlmContext`, `retrieveForTenant`, `CONTEXT_LAYERS` | `ContextTab.tsx` in `DeviceInspectorDrawer.tsx`, `PduSimulationPanel.tsx` | `wiring.test.ts` |
| 8 | `ed25519Verifier.ts` | §4.1, §4.5 (IAM-001) | `generateSessionKeypair`, `signPayload`, `verifySignature` | `BreakGlassModal.tsx`, `AuditChainViewer.tsx` | `guards.test.ts`, `engines2.test.ts`, `wiring.test.ts` |
| 9 | `employeeFactory.ts` | §6.3, §6.8 (FAC-001..FAC-003) | `createEmployee`, `validateEmployee`, `generateEmployeeFiles` | `EmployeeFactoryModal.tsx`, `Dock.tsx` drop | `factoryAndInspector.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 10 | `factoryPlacement.ts` | §6.3, §1.4.1 | `resolveDepartmentAndManager`, `nextEmployeeId`, `placeEmployee` | `TopologyCanvas.tsx` (drop on zone/canvas), `EmployeeFactoryModal.tsx` | `engines2.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 11 | `generators.ts` | §2.1 (The Six-File Anatomy) | `generateEmployeePy`, `generateToolsPy`, `generatePoliciesPy`, `PEP_SNIPPET` | `CodeTab.tsx`, `ExportBundleModal.tsx` | `exporter.test.ts`, `wiring.test.ts` |
| 12 | `inspectorEdit.ts` | §2.2, §6.9.1 (LIF-001) | `editDocument`, `transition`, `setIdentity`, `setNetworkMode` | `DeviceInspectorDrawer.tsx` (all 6 tabs) | `factoryAndInspector.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 13 | `killSwitchManager.ts` | §4.4, §4.6.1 (REL-001) | `KillSwitchManager`, `engage`, `release`, `check` | `KillPlaneModal.tsx`, `PduSimulationPanel.tsx` (Steps 4+5) | `engines2.test.ts`, `guards.test.ts`, `wiring.test.ts` |
| 14 | `layout.ts` | §6.9 | `alignNodes`, `distributeNodes`, `autoLayout` | `TopControlBar.tsx`, `CommandPaletteModal.tsx`, `TopologyCanvas.tsx` | `engines2.test.ts`, `wiring.test.ts` |
| 15 | `permissionStore.ts` | §4.2.1 | `checkPermission`, `grantPermission`, `revokePermission` | `PoliciesTab.tsx` (RBAC Lab), `ComponentInfoModal.tsx` | `policy.test.ts`, `wiring.test.ts` |
| 16 | `policyEngine.ts` | §4.3 (5 Policy Tiers) | `evaluatePolicy`, `evaluateAllTiers`, 5-tier pipeline | `PoliciesTab.tsx` (Interactive Lab), `cablingValidator.ts` | `policy.test.ts`, `wiring.test.ts` |
| 17 | `pricingCalculator.ts` | §6.1.2 | `parsePricing`, `costMicro`, `costUsd`, `usdToMicro` | `PduSimulationPanel.tsx` (Steps 4+5 Cost), `ConfigEditorModal.tsx` | `policy.test.ts`, `wiring.test.ts` |
| 18 | `problems.ts` | Architecture Constitution | `findProblems`, `errorCount`, `warningCount` | `ProblemsPanel.tsx`, `StatusBar.tsx`, `TopologyCanvas.tsx` (MiniMap error nodes) | `problemsMemo.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 19 | `qualityGates.ts` | §6.3.1 (Intake Quality Gates) | `evaluateQualityGates`, `DEFAULT_GATES` | `EmployeeFactoryModal.tsx` | `factoryAndInspector.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 20 | `scoringEngine.ts` | §3.3.1, §3.3.2 (EVA-001) | `decide`, `calculateFitScore`, `DECISION_RULE` | `PduSimulationPanel.tsx` (Interactive Rubric & Decision badge) | `policy.test.ts`, `simulation.test.ts`, `wiring.test.ts` |
| 21 | `secretGuard.ts` | §5.5 (SEC-001) | `isSecretRef`, `scanSecrets`, `validateSecretRef` | `IdentityTab.tsx` (Secrets Manager), `qualityGates.ts` | `guards.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 22 | `simPlayer.ts` | §3.1.3 | `playerReducer`, `initialPlayer`, `isFinished` | `PduSimulationPanel.tsx` (Play/Step/Stop/Reset) | `exporter.test.ts`, `simulation.test.ts`, `wiring.test.ts` |
| 23 | `simulationRunner.ts` | §3.1.3 (9-Step Lifecycle Loop) | `runSimulation`, `executeStep` | `PduSimulationPanel.tsx`, `TopologyCanvas.tsx` (Actor pulse) | `simulation.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 24 | `ssrfGuard.ts` | §5.4.3 (Approved Sources) | `validateEgress`, `parseWatchlist` | `PduSimulationPanel.tsx` (Steps 4+5 Egress), `ConfigEditorModal.tsx` | `guards.test.ts`, `ui.test.tsx`, `wiring.test.ts` |
| 25 | `zipBundle.ts` | §2.1 | `createZipBundle` (JSZip wrapper) | `ExportBundleModal.tsx` | `exporter.test.ts`, `ui.test.tsx`, `wiring.test.ts` |

---

## 2. Done-When Clauses Verification Matrix

| Done-When Item | Verification Mechanism | Status |
|---|---|---|
| **Zero Mock / Pure Engine** | All 25 engine modules are pure TS; state lives in Zustand + Immer | Verified |
| **Fail-Closed Default Deny** | `POL_DEFAULT_DENY` in `policyEngine.ts` & `scoringEngine.ts` (band 40–49.9) | Verified |
| **9-Step Loop (§3.1.3)** | Verbatim step names, order (with Steps 4+5 combined loop and early abort return) in `simulationRunner.ts` | Verified |
| **6-Layer Context (§5.2.2)** | Sequential prompt injection order and TEN-003 tenant filter in `ContextTab.tsx` | Verified |
| **Rubric Score (§3.3.2)** | Formula-driven `calculateFitScore` in `PduSimulationPanel.tsx` | Verified |
| **Token Pricing (§6.1.2)** | Exact micro-USD pricing via `parsePricing` and `costUsd` | Verified |
| **Live YAML Config Editor** | `ConfigEditorModal.tsx` with Ajv schema validation | Verified |
| **ProtocolEdge Badges & Portal** | `EdgeLabelRenderer` + `CableDetailModal.tsx` | Verified |
| **Component Info Modal** | "i" buttons on node, dock, inspector opening `ComponentInfoModal.tsx` with `help` & SSOT | Verified |
| **Kind-Colored MiniMap** | Interactive, kind-based nodes, error alerts, cable legend in `TopologyCanvas.tsx` | Verified |
| **Full Arabic Localization** | 100% dictionary parity, `messages/` catalog, RTL logical styling | Verified |
