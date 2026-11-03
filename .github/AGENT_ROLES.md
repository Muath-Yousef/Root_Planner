# AI Agent Roles & Architecture — Root_Planner Pipeline
<!-- AUTO-LOADED by Pipeline MCP Server — DO NOT DELETE -->
<!-- Any AI connecting to the local MCP server reads this file first -->

## 🔍 ANALYZER ROLE (Claude Desktop)

**Trigger:** User reports a problem, requests analysis, monitors execution, or verifies a previous fix.

**How you know this is your role:**
- You are connected to Claude Desktop with the Pipeline MCP Server active
- User asks about bugs, performance, code review, or "what's wrong with X"

**Responsibilities:**
1. Call `get_my_role()` at session start — confirms your role and displays repo connectivity.
2. Read the codebase via GitHub MCP (`get_file_contents`, `search_code`, `list_commits`).
3. Identify issues, improvements, or verify previous fixes.
4. Create task definitions using `create_task()` — they auto-push to GitHub.
5. Report findings to the user with clear, actionable summaries.

**Task file format** (written to `commit/tasks/TASK_<timestamp>_<slug>.md`):
```markdown
PRIORITY: high|medium|low
TYPE: bug|feature|refactor|docs|perf
FILES_AFFECTED: src/..., tests/...
DESCRIPTION: Clear description of what needs to be done
ACCEPTANCE_CRITERIA:
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
TASK_REF: TASK_<timestamp>_<slug>
STATUS: pending
```

**Do NOT:** Write application code directly. Your job is analysis, triage, and task specification.

---

## ✍️ IMPLEMENTER ROLE (Claude Code / Antigravity / Any Coding Agent)

**Trigger:** New task in `commit/tasks/` / `docs/pipeline/tasks/` OR PR labeled `ai:implement`.

**How you know this is your role:**
- You are running in Claude Code, Antigravity IDE, terminal CLI, or coding session.
- OR: `list_pending_tasks()` returns tasks with `STATUS: pending`.

**Responsibilities:**
1. Call `get_my_role()` — confirms Implementer role.
2. Call `list_pending_tasks()` — inspect available tasks in the queue.
3. Call `claim_implementer(task_id, agent_name)` — marks task `in_progress` and pushes this status immediately to GitHub so other agents know it is being worked on.
4. Write solution files to `commit/inbox/` (or directly into project folders if operating with full repo write tools).
5. Push changes using the automated PR workflow:
   ```bash
   bash scripts/push-commit.sh --pr <task_id>
   ```
   → This automatically branches into `ai/fix-<task_id>`, pushes to GitHub, and triggers GitHub Actions to open an automated Pull Request.

**Do NOT:** Directly merge your own PR into `main`. The Reviewer evaluates and merges.

---

## 🧠 REVIEWER ROLE (AI Studio / Cursor IDE / gh CLI / Any Reviewer)

**Trigger:** PR opened or labeled `ai:review`.

**How you know this is your role:**
- You are in AI Studio, Cursor, Windsurf, or review terminal.
- OR: `get_pending_reviews()` lists open PRs requiring inspection.

**This role is TOOL-AGNOSTIC — seamless handoff between tools:**
- **AI Studio (Web/API):** Open PR URL, inspect changed files, submit review.
- **Cursor / Windsurf / VS Code:** Checkout `ai/fix-*` branch, inspect diff, test locally.
- **`gh` CLI:** `gh pr review <number> --comment -b "your comment"`
- **Claude / Any MCP Client:** Call `get_pending_reviews()` and submit verdicts with `submit_review_note()`.

**Responsibilities:**
1. Call `get_my_role()` — confirms Reviewer role and active PR queue.
2. Call `get_pending_reviews()` — lists active PRs and AI branches.
3. Verify acceptance criteria against the original task file.
4. **Approval:** If all tests and criteria pass, approve the PR to merge into `main`.
5. **Changes Requested:** Call `submit_review_note(pr_or_branch, verdict, notes, suggested_fixes)` to record review notes in `commit/reviews/` which sync to GitHub.

---

## 🔄 End-to-End Pipeline Lifecycle

```
[Claude Desktop (Analyzer)]
       │
       ▼ create_task()
[commit/tasks/TASK_*.md] ──(push-commit.sh)──► [docs/pipeline/tasks/ on GitHub]
                                                          │
                                                          ▼ list_pending_tasks() & claim_implementer()
                                             [Claude Code / Antigravity (Implementer)]
                                                          │
                                                          ▼ Writes solution to commit/inbox/
                                             [push-commit.sh --pr <task_id>]
                                                          │
                                                          ▼
                                             [GitHub Branch: ai/fix-*]
                                                          │ (GitHub Actions: auto-pr.yml)
                                                          ▼
                                             [Pull Request opened on GitHub]
                                                          │
                                                          ▼ get_pending_reviews()
                                             [AI Studio / Reviewer]
                                                          │
                                                          ▼ Approves & Merges
                                             [main branch updated ✅]
```

---

## 🔑 Account-Agnostic Architecture (تبديل الحسابات دون فقدان السياق)

المنظومة مصممة لتكون **مستقلة تماماً عن أي حساب محدد أو جلسة دردشة منفردة**:

1. **مصدر الحقيقة الموحد (Single Source of Truth):**
   كل حالات المهام (`pending`, `in_progress`, `completed`) وملاحظات المراجعة تُخزن داخل ملفات Markdown في مستودع GitHub (`docs/pipeline/tasks/` و `docs/pipeline/reviews/`).

2. **عند نفاذ الـ Tokens أو تغيير الحساب:**
   - يمكنك تسجيل الدخول بحساب جديد في Claude Desktop أو تبديل مفتاح API في AI Studio.
   - حدّث الـ Token في `claude_desktop_config.json` أو في متغير البيئة `GITHUB_PERSONAL_ACCESS_TOKEN`.
   - عند تشغيل أي أداة أو عميل جديد، استدعِ ببساطة `get_my_role()` أو `get_pipeline_status()`.
   - سيتعرف الوكيل الجديد على موقعه في خط الإنتاج فوراً ويكمل العمل دون الحاجة لإعادة شرح المشروع أو تحميل الملفات من الصفر.

---
*Last updated: 2026-11-03 | Version: 2.0.0*
