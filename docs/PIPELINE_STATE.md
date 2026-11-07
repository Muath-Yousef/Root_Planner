# MCP Pipeline — Operational State (Phase 0, 7 Nov 2026)

Checked on branch `plan/root-planner-improvement` at commit `23c52c5`
(later commits in this branch are Phase 0 work, not pipeline changes).

## What exists

The pipeline is a file-based task ledger plus the scripts that move files
through it — not a hosted service:

| Piece | Location | What it does |
|---|---|---|
| MCP server | `scripts/pipeline-mcp-server.mjs` | Task create/list and review-submit tools; tasks are created in `commit/tasks/`, reviews in `commit/reviews/` |
| Watcher | `scripts/push-commit.sh` | Routes `commit/tasks/` → `docs/pipeline/tasks/` and commits + pushes to GitHub |
| Status report | `scripts/pipeline-status.sh` | One-shot (or `--watch`) queue/branch report |
| In-app MCP server | `server.ts` (SSE transport) | Serves MCP tools inside the running app |
| Console | `src/components/modals/McpConsoleModal.tsx` | Lists pending tasks (`list_pending_tasks`) |
| Ledger | `docs/pipeline/tasks/` (4 files), `docs/pipeline/reviews/` (1 file) | The task and review records themselves |

## Live reading (7 Nov 2026, `bash scripts/pipeline-status.sh`)

- Watcher Service: **STOPPED** (`systemctl --user start root-planner-watcher`) —
  the watcher is a systemd user service on the founder's machine; it does not
  run in this sandbox, and starting it here would be wrong (it commits and
  pushes to the founder's repo).
- Tasks synced: 4 in `docs/pipeline/tasks/` — 3 `pending`, 1 `completed`.
- Tasks in progress: 0 claimed. Queued: 0. Reviews: 0 queued / 1 synced.
- Push failures: 0 (clean). No local `ai/*` branches.

## What is NOT proven

The end-to-end loop (task created → auto-routed → auto-pushed → claimed →
reviewed) has never been demonstrated: the pipeline's own test task
(`TASK_20261103113513_ai-multi-agent-pipeline-test`, 3 Nov 2026) is still
`pending` with all three acceptance criteria unchecked (auto-route to
`docs/pipeline/tasks/`, auto-push to GitHub, trackable across account
switches). Treat the pipeline as a **document ledger with working tooling**,
not as a proven automated workflow, until that task is completed on the
founder's machine where the watcher runs.

## How this plan uses it

Each phase of the improvement plan is opened as a task file in
`docs/pipeline/tasks/` (the ledger), and the work itself is done on the
`plan/root-planner-improvement` branch. Nothing in this plan starts the
watcher, claims a task through the MCP server, or pushes to the remote —
those steps stay with the founder on his own machine.
