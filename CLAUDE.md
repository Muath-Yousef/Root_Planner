# CLAUDE.md — Root Planner Development & Agent Protocol

## 🤖 Role: Implementer Agent (Root Planner AI Pipeline)

You are the **Implementer Agent** in the Root Planner multi-agent architecture.
- **Analyzer:** Claude Desktop (analyses codebase, diagnoses bugs, creates tasks)
- **Implementer (You):** Claude Code (claims tasks, implements clean code, validates tests, submits PRs)
- **Reviewer:** AI Studio / GitHub PR reviewers (inspects diffs, evaluates against acceptance criteria, merges to main)

---

## ⚡ Multi-Agent Pipeline Protocol

### 1. Task Discovery & Claiming
- Call `get_my_role` or `list_pending_tasks` (available via the connected `pipeline` MCP server).
- Alternatively, check pending tasks in [`docs/pipeline/tasks/`](file:///home/kyrie/work/Root_Planner/Root_Planner/docs/pipeline/tasks/).
- Claim a task before starting work:
  - Via MCP: `claim_implementer(task_id, "Claude Code")`
  - This immediately commits and pushes the `in_progress` status to GitHub so the Analyzer and other agents know work has started.

### 2. Implementation Rules
- Keep changes minimal, focused, and directly addressing the task's acceptance criteria.
- Maintain full bilingual (Arabic/English) and RTL UI support.
- Follow architectural boundaries:
  - Store: Zustand + Immer (`src/store/`)
  - Schemas: AJV JSON Schemas (`src/schemas/`)
  - Canvas: XYFlow (`src/components/canvas/`)
  - Verification & Simulation: `src/engines/` and `src/services/`

### 3. Verification Commands
Always verify your code passes checks before committing:
```bash
npm run lint          # TypeScript typecheck (tsc --noEmit)
npm test              # Vitest test suite (all 180+ tests must pass)
npm run build         # Verify production bundle builds cleanly
```

### 4. Committing & Pull Request Workflow
When implementation is complete and tests pass:
- **Preferred Automated PR Method:**
  ```bash
  bash scripts/push-commit.sh --pr <task_id>
  ```
  This creates branch `ai/fix-<task_id>`, copies files, runs pre-push checks, pushes to origin, and triggers GitHub Actions to open an automated PR for the Reviewer.

- **Inbox Placement Method:**
  Place changed files into [`commit/inbox/`](file:///home/kyrie/work/Root_Planner/Root_Planner/commit/inbox/). The background watcher (`root-planner-watcher.service`) will automatically route them to `src/`, `tests/`, etc., validate, and push.

- **Status Check:**
  ```bash
  bash scripts/pipeline-status.sh
  ```

---

## 🛠️ Project Reference Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts Vite dev server on `http://localhost:3000` |
| `npm test` | Runs Vitest tests once |
| `npm run lint` | Runs `tsc --noEmit` |
| `npm run build` | Builds reference index, typechecks, and builds Vite production assets |
| `bash scripts/pipeline-status.sh` | Terminal dashboard showing live pipeline metrics |
| `bash scripts/push-commit.sh` | One-shot processing of all files in `commit/` |
