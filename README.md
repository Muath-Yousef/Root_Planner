# socroot-topology-studio

A production-grade, Cisco Packet Tracer-style visual topology studio for architecting, validating, simulating, and packaging digital employee organizations, adhering strictly to **`MASTER_REFERENCE_v1.1_fea52b40.md`**.

## Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Run test suite (25 test suites, 216 unit, integration & UX tests)
npm test

# 3. Type check & production build (optimized vendor chunks < 500 KB)
npm run build

# 4. Start local development server
npm run dev
```

## Documentation & Auditing

- **Governing Specification (Single Source of Truth):** [`MASTER_REFERENCE_v1.1_fea52b40.md`](./MASTER_REFERENCE_v1.1_fea52b40.md) (149 indexed sections in root).
- **UX Scenarios & Criteria:** [`docs/UX_TASKS.md`](./docs/UX_TASKS.md) — 6 canonical user experience evaluation tasks for non-programmers.
- **Manual & Visual QA Checklist:** [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md) — comprehensive Arabic step-by-step testing protocol with automated vs. visual browser caveats.
- **Engine Traceability Matrix:** [`docs/TRACEABILITY.md`](./docs/TRACEABILITY.md) — 25 engine modules bidirectionally mapped to reference sections, UI components, and test suites.
- **Sync & Batch Notes:** [`docs/SYNC_NOTES.md`](./docs/SYNC_NOTES.md) — detailed architecture decisions across batches 1 through 8.
- **Reference Gaps & Disambiguations:** [`docs/REFERENCE_GAPS.md`](./docs/REFERENCE_GAPS.md) — canonical handling of ambiguous bands and role source derivations.
- **Declarative Design Language (DSL):** [`docs/DSL.md`](./docs/DSL.md) — describe a topology in YAML and compile it to a v2 `.socroot.json` file (Phase 1); v3 as the first example.
- **Automatic Layout Engine:** [`docs/LAYOUT.md`](./docs/LAYOUT.md) — lanes/grid, zone auto-sizing, edge-endpoint spreading (Phase 2); the v3 example now builds its zone children from the grid.

## Architectural Highlights

- **Pure Client-Side Engine**: Zero server, zero external API dependencies for diagramming, deterministic policy checking, simulation, and bundle packaging.
- **Nine-Step Lifecycle Loop (§3.1.3)**: Faithful, step-by-step implementation of `DepartmentManager.run_objective_cycle`:
  - Step 1: Receive & Validate Task PDU
  - Step 2: Decompose Objective into Stage Plan
  - Step 3: Budget Reserve & Token Allocation
  - **Steps 4+5 (Unified Loop):** Emergency Circuit Breaker check, `_dispatch_and_monitor` for each employee, Model Failover, and Early Abort Gate when Evaluator `fit_score < 40.0` (halts execution immediately with `ABORT_REPORT`, skipping steps 6–9).
  - Step 6: Validate Output against Acceptance Contract & SLA (`TASK_RESULT`).
  - Step 7: Founder Escalation (only when triggered).
  - Step 8: State Driver Optimistic Update.
  - Step 9: SHA-256 Cryptographic Audit Chain & Budget Reconcile.
- **5-Tier Policy Engine (§4.3)**:
  - Tier 1: Hard Denies (`POL_DRF_HARD_01`, `POL_SSRF_HARD_BLOCK`).
  - Tier 2: Core RBAC & Permission Matrix (`fnmatch` wildcards).
  - Tier 3: Decision Gates (Fit score thresholds & model routing).
  - Tier 4: Network & Channel Guards.
  - Tier 5: Default Deny.
- **Digital Employee Anatomy (ORG-003, §2.2)**: Every employee bundle is packaged with 6 canonical files:
  1. `manifest.yaml`: Role identity, memory tiers, model parameters, and channel bindings.
  2. `contract.json`: Input/output JSON Schema specifications, SLAs, and quality gates.
  3. `employee.py`: Autonomous execution logic, lifecycle hooks, and dispatch handlers.
  4. `tools.py`: Declared tool definitions, parameter schemas, and least-privilege sandboxes.
  5. `policies.py`: Local policy overrides, circuit breakers, and rate limiters.
  6. `skills/` & `playbook.md`: Domain-specific SOP playbooks, prompt templates, and execution guidelines.
- **Three Independent State Machines (LIF-001, §6.9.1)**:
  - Lifecycle: `DRAFT` ➔ `VALIDATED` ➔ `BENCHMARKED` ➔ `CERTIFIED` ➔ `DEPRECATED`
  - Deployment: `STOPPED` ➔ `PROVISIONING` ➔ `RUNNING` ➔ `HEALTHY` ➔ `DEGRADED` ➔ `FROZEN`
  - Autonomy: `L1_SHADOW` ➔ `L2_ASSISTED` ➔ `L3_LIMITED_AUTONOMOUS` ➔ `L4_AUTONOMOUS` ➔ `L5_FOUNDER_DELEGATE`
- **Strict Quality Gates & SEC-001**: Every secret must strictly match `vault://<scope>/<key>`. Plaintext API keys/tokens are rejected fail-closed.
- **Comprehensive Accessibility & Keyboard Navigation**:
  - `Ctrl+K` / `Cmd+K`: Instant Command Palette opening.
  - Dock Tab Navigation: Focusable cards with `Enter`/`Space` deployment and factory modal triggers.
  - Focus Trapping (`useModalA11y`): Modal focus trapping with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Topmost Dismissal: `Escape` key closes only the topmost modal on the stack and restores focus to its trigger element.
  - Screen Readers: Localized `aria-label` attributes on 100% of icon-only action buttons in Arabic and English.
- **High-Performance Canvas**: Tested with 300 concurrent nodes; selective Zustand subscriptions and `React.memo` guarantee that moving one node never triggers re-rendering of the remaining 299 nodes.
- **Full Bilingual & Logical CSS**: Seamless English / Arabic support with RTL mirroring, logical layout properties (`ms-*`, `me-*`, `ps-*`, `pe-*`), and preserved LTR direction on technical identifiers.

**END_OF_THIS_FILE**
