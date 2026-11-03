# SOCROOT Topology Studio — UX Evaluation & Task Scenarios

This document defines 6 canonical user experience tasks designed for non-programmer operators to architect, inspect, simulate, and export digital employee organizations with total confidence and zero dead ends.

---

## Task 1: Create a New Company Organization

* **Goal:** Launch the application, explore pre-packaged starting points, and generate a new company tenant using the 3-step wizard.
* **Steps:**
  1. Open the Start Screen (`/`).
  2. Click **Start New Company Wizard** ("انشر شركة جديدة").
  3. Enter company name (`Acme Defense Systems`), select tenant profile (`socroot-core`), choose isolation model (`logical_rls`), and select `CURRENT` horizon.
  4. Click **Create Company**.
* **Pass Criterion:**
  - Company is instantiated immediately, stored in IndexedDB, and opened in the visual canvas with the 5-step guided onboarding tour.
  - Zero dead ends; wizard focus trapping and validation block invalid inputs.

---

## Task 2: Add and Wire a Digital Employee

* **Goal:** Drag or deploy a new employee node from the Dock catalogue and connect it to a Manager node via protocol cables.
* **Steps:**
  1. Open the Dock catalogue under **Employees**.
  2. Click or drag **Market Analyst Drafter** (`drafter`) onto the canvas.
  3. In the Employee Factory modal, configure prefix (`acq_drafter`), manager binding (`opp_acq.manager.v1`), and model parameters. Click **Deploy**.
  4. Drag a cable from the Manager node's `out:TASK_DISPATCH_RESULT` port to the Drafter node's `in:TASK_DISPATCH_RESULT` port.
* **Pass Criterion:**
  - Protocol edge is drawn instantly with proper color coding (`#2cc4dd`) and animated particle signals.
  - Rejection banner or toast notifies if an invalid cable type or role link is attempted.

---

## Task 3: Identify and Resolve an Organization Problem

* **Goal:** Use the Problems Panel and Device Inspector to locate an egress network error and resolve it without writing code.
* **Steps:**
  1. Click **Open Problems** in the Status Bar next-step line or side panel tab.
  2. Select an error item (e.g., `POL_DRF_HARD_01`: hard egress prohibited for role).
  3. Click **Zoom to node** or double-click the problematic node to open the Device Inspector.
  4. Navigate to the **Contract** tab, inspect the red problem badge (`1`), and update `docker_network` to `none`.
* **Pass Criterion:**
  - Problem count in the status bar decreases immediately, tab badge disappears, and the Export ZIP button unlocks.

---

## Task 4: Simulate a Failure Scenario & Review Audit Chain

* **Goal:** Run a PDU lifecycle cycle under injected fault conditions (e.g., Model Failover 429/503), test early abort gates, and verify cryptographic audit hashes.
* **Steps:**
  1. Switch to **Simulate** mode via the top control bar or `⌘K` palette.
  2. In the Simulation Panel, check **Model failover (429/503)**.
  3. Set fit score slider to `35.0` (triggering Evaluator Abort Gate `< 40.0`).
  4. Click **Run Task** (`▶`). Use Space to pause, `←`/`→` arrows or scrub timeline to inspect steps.
  5. Verify the final **Execution Summary Card** and click **Verify Audit Chain**.
* **Pass Criterion:**
  - Simulation executes Steps 1 through 5, triggers early abort gate at Step 5 (`ABORT_REPORT`), highlights active actor nodes/pulsing cables on canvas, and displays a verified SHA-256 audit chain.

---

## Task 5: Export Organization ZIP Bundle

* **Goal:** Validate company topology and export a production-ready 6-file employee organization bundle.
* **Steps:**
  1. Ensure 0 blocking errors in the Problems Panel.
  2. Click **Export ZIP** (`top.export`) in the top bar.
  3. In the Export Bundle modal, select target employees and click **Download ZIP Bundle**.
* **Pass Criterion:**
  - Success toast appears with confirmation, and a valid ZIP file containing canonical `manifest.yaml`, `contract.json`, `employee.py`, `tools.py`, `policies.py`, and `playbook.md` files is downloaded.

---

## Task 6: Recover from an Accident or Deletion

* **Goal:** Accidental deletion of a connected node or project with instant confirmation protection and 1-click Undo recovery.
* **Steps:**
  1. Select a connected employee node on the canvas.
  2. Press `Delete` or `Backspace`.
  3. Review the **Confirm Dialog** stating component and connected cable counts, then click **Confirm**.
  4. When the deletion toast appears at the bottom-start, click **Undo** (or press `Ctrl+Z`).
* **Pass Criterion:**
  - ConfirmDialog prevents accidental deletion without confirmation; clicking Undo restores the deleted node and all its connected cables instantly.

---

## Responsiveness & Viewport Matrix

| Viewport Width | Top Control Bar Layout | Side Panel Behavior | Touch & Keyboard Navigation |
| :--- | :--- | :--- | :--- |
| **≥ 1280 px** | Full clusters with icons + text labels | Expanded, resizable (280px–600px) | Full hotkeys, Tab trapping in modals |
| **1024 px - 1279 px** | Medium clusters with icon-only buttons | Auto-collapsed side panel (expandable) | Full keyboard palette (`Ctrl+K`), touch drag |
| **< 1024 px** | Compact header with "More ▾" dropdown | Collapsed drawer overlay | Accessible touch targets, focus restoration |
