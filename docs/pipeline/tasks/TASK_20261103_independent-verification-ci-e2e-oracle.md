# TASK: Independent Verification — CI, Real-Browser E2E, Oracle & Property Tests, Usability Protocol

- **Created:** 2026-11-03
- **Author:** Analyzer Agent
- **Status:** PENDING (awaiting Implementer)
- **Priority:** High
- **Type:** Testing / Verification infrastructure (no feature work)

---

## Title
Turn every UX and correctness claim into evidence checkable by someone other than the author

## Context / Critique Summary
- The prior "done" report does not match GitHub: `main` is still at `210b3cd` with 174 tests, `createLazy` still has 14 references, the README marker is still present, and there is no contrast script. Any work exists only inside AI Studio and was never pushed.
- The repo has no CI, no real-browser tests and no property tests. Everything "verified" so far was checked in jsdom by the author, the reviewer or Gemini.
- A professional would stop adding features and measure: usability testing with non-authors, correctness checked against the reference document and a real downstream consumer (Python), and real-browser traces.

## Description (Goal)
Produce independently checkable evidence for the app's UX and correctness. **No new features.**

**Hard rules**
- Do NOT change `src/engine` rules, schemas, cable rules, or scoring thresholds.
- A bug found by these checks may be fixed only after a failing test reproduces it.
- Start immediately; ask no questions.
- New devDependencies only: `@playwright/test`, `@axe-core/playwright`, `fast-check`. No runtime dependency changes.
- Do not weaken any assertion to make it pass. A failure becomes an entry in `docs/usability/FINDINGS.md` with evidence (trace, screenshot or raw file).
- Keep the existing 181-test suite passing; main chunk stays under 400 kB.
- No UX change without a cited raw observation ID.

## Step 0 — Confirm `main` state (before reporting anything)
1. `git log -1` (report the commit SHA)
2. `npm ci && npm run build && npm test`
3. `grep -c createLazy src/components/layout/StudioLayout.tsx`
4. Anything not pushed is not done.

## Work Items (execute in this order)

### 1. Independent CI runner
- Add `.github/workflows/verify.yml`: ubuntu-latest, current Node LTS, Python 3.12; triggers on push and pull_request to `main`.
- Steps: `npm ci`, `tsc --noEmit`, build, vitest, install Chromium, run Playwright, upload traces / screenshots / JSON reports as artifacts.

### 2. Real-browser tests (`e2e/`, `@playwright/test` + `@axe-core/playwright`)
- **Six tasks from `docs/UX_TASKS.md`** with real mouse drags:
  - Dock to canvas
  - Drafter-to-external cable must be rejected with `POL_DRF_HARD_01`
  - Port dimming during drag
  - Inspector opens via double-click
  - Export of a valid ZIP
  - Undo after delete
  - Run Task 2 a second time keyboard-only.
- **Matrix:** widths 1024 / 1280 / 1440 × LTR/RTL × dark/light. Assert:
  - top-bar controls do not overflow or overlap (bounding-box comparison)
  - side panel collapses below 1100 px
  - no horizontal page scroll
  - save a screenshot per cell.
- **Accessibility:** axe on start screen, studio, inspector, and each modal when open — zero serious/critical violations. Also a keyboard-only run.
- **Performance:** load a 300-node project, drag one node with the mouse for 2 s, record frame times and long tasks via a CDP trace. Save p50 and p95 to `docs/perf/baseline.json`. Target p95 < 50 ms; do not tune thresholds to pass — a failure is recorded as a finding.

### 3. Oracle from the raw reference
A test reads `MASTER_REFERENCE_v1.1_fea52b40.md` directly and checks the export of the reference department (§6.5 department example) against it:
- The six schemas validate the exported files using **Python `jsonschema` in CI** (no shared code with Ajv).
- `python -m py_compile` passes on every exported `employee.py`, `tools.py`, `policies.py`.
- Export → import → export is **byte-identical**.
- The embedded PEP block (`PEP_BEGIN..PEP_END`) in generated code matches the reference text.

### 4. Property tests (`fast-check`)
- For random node pairs: no accepted cable gives network egress to a drafter, an evaluator, or any `networkMode: 'none'` node; every accepted cable kind is one `PAIRS` allows.
- `decide()` is monotonic over 0–100, reaches all four outcomes, and returns `ESCALATE` for 40–49.9.
- Any inspector edit that returns `ok: true` leaves the document schema-valid.

### 5. Human evidence (protocol only — a human runs it)
Create:
- `docs/usability/PROTOCOL.md`
- `docs/usability/raw/_template.md`
- `scripts/usability-summary.mjs`

Protocol requirements: 3 participants who are not the author (≥1 non-programmer); screen + audio recorded; tasks read verbatim from `UX_TASKS.md` with no hints; per task record success, time, wrong clicks, verbatim quotes with timestamps; SUS at the end; one screen-reader pass (NVDA/Orca) of Task 2. The script totals success rate, median time and SUS from raw files. **No results may be invented.**

### 6. Reporting rule
Tag every claim in the final reply as exactly one of: `CI run URL`, `jsdom`, `human raw file path`, or `not verified`. Never write "verified" without a link or file path.

## Files Affected
**New**
- `.github/workflows/verify.yml`
- `e2e/**` (Playwright specs, axe, matrix, perf, oracle, keyboard-only run)
- Property-test files (fast-check; location per existing test layout)
- Python validation script(s) for jsonschema / py_compile (CI)
- `docs/perf/baseline.json`
- `docs/usability/PROTOCOL.md`
- `docs/usability/raw/_template.md`
- `docs/usability/FINDINGS.md` (for failures)
- `scripts/usability-summary.mjs`
- `playwright.config.ts`

**Modified**
- `package.json` (devDependencies only; scripts for e2e)
- Lockfile

**Read-only inputs**
- `docs/UX_TASKS.md`
- `MASTER_REFERENCE_v1.1_fea52b40.md`

**Must NOT change**
- `src/engine/**` rules, schemas, cable rules, scoring thresholds

**Touched read-only (grep check)**
- `src/components/layout/StudioLayout.tsx`

## Acceptance Criteria (Done when)
- [ ] `verify.yml` exists and is pushed; the CI run is green, or every failure is listed in `docs/usability/FINDINGS.md` with artifacts.
- [ ] The four oracle checks (item 3) and the property tests (item 4) exist and run in CI.
- [ ] `docs/perf/baseline.json` holds real measured numbers.
- [ ] Usability protocol, template and summary script exist (no results invented).
- [ ] Final reply gives the commit SHA, the CI run URL, and claims tagged per item 6.
- [ ] Existing 181-test suite still passes; main chunk < 400 kB.
- [ ] No changes to `src/engine` rules/schemas/cable rules/scoring thresholds; only the three allowed devDependencies added.

## Implementer Notes
- Test count baseline discrepancy: the critique cites 174 tests on `main`, the constraint cites 181. Confirm the real number in Step 0 and report it.
- Items 1–4 depend on the Step 0 result: if the AI Studio work was never pushed, say so and do not claim it.

STATUS: in_progress
CLAIMED_BY: Antigravity Implementer
CLAIMED_AT: 2026-11-03T14:54:52.983Z
