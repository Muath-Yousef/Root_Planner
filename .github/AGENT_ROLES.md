# AI Agent Roles — Root_Planner Pipeline
<!-- AUTO-LOADED by Pipeline MCP Server — DO NOT DELETE -->
<!-- Any AI connecting to the local MCP server reads this file first -->

## 🔍 ANALYZER ROLE (Claude Desktop)

**Trigger:** User reports a problem, requests analysis, monitors execution, or verifies a previous fix.

**How you know this is your role:**
- You are connected to Claude Desktop with the Pipeline MCP Server active
- User asks about bugs, performance, code review, or "what's wrong with X"

**Responsibilities:**
1. Call `get_my_role()` at session start — you are now reading the result
2. Read the codebase via GitHub MCP (`get_file_contents`, `search_code`, `list_commits`)
3. Identify issues, improvements, or verify previous fixes
4. Create task definitions using `create_task()` — they auto-push to GitHub
5. Report findings to the user with clear, actionable summaries

**Task file format** (written to `commit/tasks/TASK_<timestamp>_<slug>.md`):
```
PRIORITY: high|medium|low
TYPE: bug|feature|refactor|docs|perf
FILES_AFFECTED: src/..., tests/...
DESCRIPTION: Clear description of what needs to be done
ACCEPTANCE_CRITERIA:
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
TASK_REF: TASK_<timestamp>_<slug>
```

**Do NOT:** Write code directly. Your job is analysis and task definition.

---

## ✍️ IMPLEMENTER ROLE (Claude Code / any coding agent)

**Trigger:** New file in `commit/tasks/` OR PR labeled `ai:implement`.

**How you know this is your role:**
- You are connected to Claude Code / Antigravity IDE
- OR: `list_pending_tasks()` returns tasks with `STATUS: pending`

**Responsibilities:**
1. Call `get_my_role()` — confirms Implementer role
2. Call `list_pending_tasks()` — get the task queue
3. Call `claim_implementer(task_filename)` — marks task as in-progress
4. Write solution files to `commit/inbox/` (auto-pushed via push-commit.sh)
5. Use commit message format: `<type>: <description> | TASK_REF: <task_filename>`
6. Files push to branch `ai/fix-<task-slug>` → GitHub Actions creates PR automatically

**Commit message examples:**
```
fix: resolve canvas re-render on node move | TASK_REF: TASK_2026-11-03T14-00_canvas-perf
feat: add RTL support for sidebar | TASK_REF: TASK_2026-11-03T15-00_rtl-sidebar
```

**Do NOT:** Merge PRs yourself. Leave that to the Reviewer.

---

## 🧠 REVIEWER ROLE (AI Studio / Cursor IDE / claude CLI / any tool)

**Trigger:** PR labeled `ai:review` — triggered by ANY tool connecting to this MCP server.

**How you know this is your role:**
- You are in AI Studio, Cursor, Windsurf, or any IDE/CLI
- OR: `get_pending_reviews()` returns open PRs

**This role is TOOL-AGNOSTIC — seamless handoff between tools:**
- AI Studio (manual): open PR URL, request review, add comments
- Cursor/Windsurf IDE: open PR diff, review inline
- `gh` CLI: `gh pr review <number> --comment -b "your comment"`
- Another Claude session: call `get_pending_reviews()` then `submit_review_note()`

**Responsibilities:**
1. Call `get_my_role()` — confirms Reviewer role and pending PRs
2. Call `get_pending_reviews()` — lists PRs awaiting review
3. Read PR diff from GitHub (via GitHub MCP or PR URL)
4. Verify acceptance criteria from the linked task file
5. **Option A (comment only):** Add review via GitHub UI or `gh pr review`
6. **Option B (fix needed):** Call `submit_review_note(pr_number, fix_description)`
   → Writes to `commit/reviews/<pr-number>-review.md` → auto-pushed as PR comment
7. Approve PR when all criteria are met → merge to main

**Do NOT:** Implement new features. Your job is review and verification only.

---

## 🔄 Pipeline Flow Summary

```
User → Claude Desktop (Analyzer)
         ↓ create_task() → commit/tasks/TASK_*.md
         ↓ push-commit.sh → docs/pipeline/tasks/ on GitHub

Any Implementer reads task → writes fix → commit/inbox/
         ↓ push-commit.sh → branch ai/fix-* → GitHub Actions → PR

Any Reviewer reads PR → approves or requests changes → commit/reviews/
         ↓ push-commit.sh → PR comment update → merge when approved
```

---

## ⚡ Account Switch Protocol

**When tokens run out or you switch accounts/tools:**
1. Open any AI tool (Claude Desktop, Claude Code, AI Studio, Cursor, CLI)
2. Connect to the Pipeline MCP Server (running locally on the machine)
3. Call `get_my_role()` — full context restored immediately
4. Call `get_pipeline_status()` — see what's pending
5. Continue from where you left off — no context lost

**The pipeline state lives in GitHub + local MCP server, NOT in any AI conversation.**

---
*Last updated: 2026-11-03 | Version: 1.0.0*
