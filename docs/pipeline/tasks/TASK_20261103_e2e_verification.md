# Independent CI, Playwright E2E, Oracle & Usability Verification
TASK_REF: TASK_20261103_e2e_verification
PRIORITY: high
TYPE: test
STATUS: pending
CREATED_AT: 2026-11-03T17:00:00Z
FILES_AFFECTED: .github/workflows/verify.yml, e2e/, docs/usability/, docs/perf/baseline.json

## Description
Turn every UX and correctness claim about the app into evidence someone other than the author can check. No new features, and no changes to src/engine rules, schemas, cable rules or scoring thresholds. Confirm main contains the reported work (git log, npm ci/build/test, grep createLazy). Add a GitHub Actions workflow on a clean runner, real-browser Playwright and axe-core tests, a CDP drag-performance baseline on a 300-node project, oracle checks against the raw MASTER_REFERENCE document with independent Python validation, fast-check property tests for cable rules and scoring, and a usability protocol, template and summary script for a human to run. Any bug found is fixed only after a failing test reproduces it. Failures go in docs/usability/FINDINGS.md with evidence, and assertions are never weakened. Every claim in the final report is tagged as CI run URL, jsdom, human raw file path, or not verified.

## Acceptance Criteria
- [ ] verify.yml exists and is pushed; the CI run is green or every failure is listed in FINDINGS.md with artifacts.
- [ ] The four oracle checks (Python jsonschema validation, py_compile on exported files, export/import/export byte-identical round trip, PEP block match) and the fast-check property tests exist and run in CI.
- [ ] docs/perf/baseline.json holds real measured numbers (p50 and p95 frame times).
- [ ] The usability protocol, template and summary script exist, and no results are invented.
- [ ] The final reply gives the commit SHA, the CI run URL and the tagged claims.
