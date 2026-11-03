#!/usr/bin/env node
/**
 * Root Planner Pipeline MCP Server
 * Connects Claude Desktop, Claude Code, AI Studio, and any other AI/IDE agent
 * to the centralized GitHub pipeline with persistent role definition & task orchestration.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(SCRIPT_DIR, "..");
const ROLES_FILE = path.join(REPO, ".github", "AGENT_ROLES.md");
const COMMIT_TASKS_DIR = path.join(REPO, "commit", "tasks");
const DOCS_TASKS_DIR = path.join(REPO, "docs", "pipeline", "tasks");
const COMMIT_REVIEWS_DIR = path.join(REPO, "commit", "reviews");
const DOCS_REVIEWS_DIR = path.join(REPO, "docs", "pipeline", "reviews");

// Ensure required directories exist
for (const dir of [COMMIT_TASKS_DIR, DOCS_TASKS_DIR, COMMIT_REVIEWS_DIR, DOCS_REVIEWS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeExec(cmd, cwd = REPO) {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function getGithubToken() {
  if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) return process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const configPath = path.join(process.env.HOME || "", ".config", "Claude", "claude_desktop_config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return cfg?.mcpServers?.github?.env?.GITHUB_PERSONAL_ACCESS_TOKEN || "";
    }
  } catch {}
  return "";
}

const server = new Server(
  {
    name: "root-planner-pipeline",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_my_role",
        description:
          "ALWAYS CALL THIS FIRST at the start of a session or when switching accounts/tools. Returns your role definition (Analyzer, Implementer, or Reviewer), pipeline instructions, and live status from GitHub.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_pending_tasks",
        description:
          "Lists all tasks created by the Analyzer waiting for implementation, including priority, type, status, and affected files.",
        inputSchema: {
          type: "object",
          properties: {
            status_filter: {
              type: "string",
              enum: ["all", "pending", "in_progress", "completed"],
              description: "Filter by status. Default is 'pending'.",
            },
          },
        },
      },
      {
        name: "create_task",
        description:
          "Used by Analyzer (Claude Desktop) to define a new bug, feature, refactor, or optimization task. Automatically queues it in commit/tasks/ for push-commit.sh to sync to GitHub.",
        inputSchema: {
          type: "object",
          properties: {
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Priority of the task",
            },
            type: {
              type: "string",
              enum: ["bug", "feature", "refactor", "docs", "perf"],
              description: "Type of task",
            },
            title: {
              type: "string",
              description: "Short, descriptive title (e.g. 'Canvas node re-render optimization')",
            },
            description: {
              type: "string",
              description: "Detailed description of the problem, root cause, and expected fix",
            },
            files_affected: {
              type: "array",
              items: { type: "string" },
              description: "List of files expected to be modified or inspected",
            },
            acceptance_criteria: {
              type: "array",
              items: { type: "string" },
              description: "Specific checklist of conditions for the task to be considered complete",
            },
          },
          required: ["priority", "type", "title", "description"],
        },
      },
      {
        name: "get_task_details",
        description: "Retrieves the full content and checklist of a specific task by its filename or ID.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "string",
              description: "The filename or ID of the task (e.g. 'TASK_20261103_canvas_perf' or full filename)",
            },
          },
          required: ["task_id"],
        },
      },
      {
        name: "claim_implementer",
        description:
          "Used by Implementer (Claude Code / IDE) to claim a task and mark its status as 'in_progress', locking it so other agents know it is being worked on.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "string",
              description: "The filename or ID of the task to claim",
            },
            agent_name: {
              type: "string",
              description: "Identifier for the agent (e.g. 'Claude Code', 'Antigravity IDE', or account name)",
            },
          },
          required: ["task_id"],
        },
      },
      {
        name: "get_pending_reviews",
        description:
          "Used by Reviewer (AI Studio / Cursor / CLI / any tool) to fetch pull requests and solutions awaiting review.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "submit_review_note",
        description:
          "Used by Reviewer to submit code review feedback, approval, or change requests. Automatically writes to commit/reviews/ for push-commit.sh to sync to GitHub.",
        inputSchema: {
          type: "object",
          properties: {
            pr_or_branch: {
              type: "string",
              description: "PR number (e.g. '12') or branch name (e.g. 'ai/fix-canvas-perf')",
            },
            verdict: {
              type: "string",
              enum: ["approve", "request_changes", "comment"],
              description: "Review decision",
            },
            notes: {
              type: "string",
              description: "Detailed code review feedback, observations, and assessment",
            },
            suggested_fixes: {
              type: "string",
              description: "Optional code snippets or corrections required",
            },
          },
          required: ["pr_or_branch", "verdict", "notes"],
        },
      },
      {
        name: "get_pipeline_status",
        description:
          "Returns the current operational status of the whole pipeline: watcher service state, git branch, recent commits, pending tasks, and recent reviews.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "get_my_role": {
      let roleDoc = "";
      if (fs.existsSync(ROLES_FILE)) {
        roleDoc = fs.readFileSync(ROLES_FILE, "utf8");
      } else {
        roleDoc = "# AI Agent Roles\nFile .github/AGENT_ROLES.md not found.";
      }

      const branch = safeExec("git rev-parse --abbrev-ref HEAD");
      const lastCommit = safeExec("git log -1 --format='%h - %s (%cr)'");
      const pendingCount = fs.readdirSync(COMMIT_TASKS_DIR).filter((f) => f.endsWith(".md")).length;
      const watcherStatus = safeExec("systemctl --user is-active root-planner-watcher.service") || "inactive";

      const liveStatus = `
---
### 🔴 Live Pipeline Status
- **Current Git Branch:** \`${branch}\`
- **Last Commit:** \`${lastCommit}\`
- **Unprocessed Tasks in commit/tasks/:** \`${pendingCount}\`
- **Auto-Commit Watcher Daemon:** \`${watcherStatus}\`
- **Account-Switch Ready:** YES. Roles and task states are grounded in GitHub repository files.
`;
      return {
        content: [{ type: "text", text: `${roleDoc}\n\n${liveStatus}` }],
      };
    }

    case "list_pending_tasks": {
      const filter = args.status_filter || "pending";
      const taskFiles = new Map();

      // Collect from docs/pipeline/tasks/ first (source of truth on git)
      if (fs.existsSync(DOCS_TASKS_DIR)) {
        for (const file of fs.readdirSync(DOCS_TASKS_DIR)) {
          if (file.endsWith(".md")) {
            taskFiles.set(file, path.join(DOCS_TASKS_DIR, file));
          }
        }
      }

      // Merge with commit/tasks/ (locally queued, not yet pushed)
      if (fs.existsSync(COMMIT_TASKS_DIR)) {
        for (const file of fs.readdirSync(COMMIT_TASKS_DIR)) {
          if (file.endsWith(".md") && !file.startsWith(".")) {
            taskFiles.set(file, path.join(COMMIT_TASKS_DIR, file));
          }
        }
      }

      if (taskFiles.size === 0) {
        return {
          content: [{ type: "text", text: "No tasks found in pipeline." }],
        };
      }

      const results = [];
      for (const [filename, filepath] of taskFiles.entries()) {
        try {
          const content = fs.readFileSync(filepath, "utf8");
          const priorityMatch = content.match(/PRIORITY:\s*(\w+)/i);
          const typeMatch = content.match(/TYPE:\s*(\w+)/i);
          const statusMatch = content.match(/STATUS:\s*(\w+)/i);
          const descMatch = content.match(/DESCRIPTION:\s*([^\n]+)/i);

          const status = (statusMatch ? statusMatch[1] : "pending").toLowerCase();
          if (filter !== "all" && status !== filter.toLowerCase()) {
            continue;
          }

          results.push({
            id: filename,
            priority: priorityMatch ? priorityMatch[1] : "medium",
            type: typeMatch ? typeMatch[1] : "task",
            status,
            description: descMatch ? descMatch[1] : "No description provided",
            location: filepath.includes("commit/tasks") ? "Queued in commit/tasks (waiting for push)" : "Synced in docs/pipeline/tasks",
          });
        } catch {}
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No tasks matching status '${filter}'. Total tracked: ${taskFiles.size}` }],
        };
      }

      let formatted = `### 📋 Pipeline Tasks (${results.length} item(s) matching '${filter}'):\n\n`;
      for (const t of results) {
        const icon = t.status === "completed" ? "✅" : t.status === "in_progress" ? "⏳" : "📌";
        formatted += `${icon} **\`${t.id}\`**\n`;
        formatted += `  - **Priority:** ${t.priority.toUpperCase()} | **Type:** ${t.type} | **Status:** ${t.status}\n`;
        formatted += `  - **Summary:** ${t.description}\n`;
        formatted += `  - **State:** ${t.location}\n\n`;
      }

      return {
        content: [{ type: "text", text: formatted }],
      };
    }

    case "create_task": {
      const { priority, type, title, description, files_affected = [], acceptance_criteria = [] } = args;

      const now = new Date();
      const dateStr = now.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

      const taskId = `TASK_${dateStr}_${slug}`;
      const filename = `${taskId}.md`;
      const targetPath = path.join(COMMIT_TASKS_DIR, filename);

      const criteriaLines =
        acceptance_criteria.length > 0
          ? acceptance_criteria.map((c) => `- [ ] ${c}`).join("\n")
          : "- [ ] Complete implementation\n- [ ] Pass automated tests\n- [ ] Code reviewed";

      const filesLines = files_affected.length > 0 ? files_affected.join(", ") : "None specified";

      const fileContent = `# ${title}
TASK_REF: ${taskId}
PRIORITY: ${priority}
TYPE: ${type}
STATUS: pending
CREATED_AT: ${now.toISOString()}
FILES_AFFECTED: ${filesLines}

## Description
${description}

## Acceptance Criteria
${criteriaLines}
`;

      fs.writeFileSync(targetPath, fileContent, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `✅ Task successfully created!\n\n- **Task ID:** \`${taskId}\`\n- **File:** \`commit/tasks/${filename}\`\n\nThe local \`push-commit.sh\` watcher will automatically route this task to \`docs/pipeline/tasks/\` and commit & push it to GitHub. Implementer agents can now view and claim this task.`,
          },
        ],
      };
    }

    case "get_task_details": {
      const { task_id } = args;
      const candidates = [
        path.join(COMMIT_TASKS_DIR, task_id.endsWith(".md") ? task_id : `${task_id}.md`),
        path.join(DOCS_TASKS_DIR, task_id.endsWith(".md") ? task_id : `${task_id}.md`),
      ];

      let foundPath = "";
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          foundPath = c;
          break;
        }
      }

      if (!foundPath) {
        // Fallback search
        const allFiles = [
          ...fs.readdirSync(COMMIT_TASKS_DIR).map((f) => path.join(COMMIT_TASKS_DIR, f)),
          ...fs.readdirSync(DOCS_TASKS_DIR).map((f) => path.join(DOCS_TASKS_DIR, f)),
        ];
        const match = allFiles.find((f) => f.includes(task_id));
        if (match && fs.existsSync(match)) {
          foundPath = match;
        }
      }

      if (!foundPath) {
        return {
          content: [{ type: "text", text: `❌ Task '${task_id}' not found in commit/tasks/ or docs/pipeline/tasks/.` }],
        };
      }

      const content = fs.readFileSync(foundPath, "utf8");
      return {
        content: [
          {
            type: "text",
            text: `### 📄 Task Details: \`${path.basename(foundPath)}\`\n**Path:** \`${foundPath}\`\n\n${content}`,
          },
        ],
      };
    }

    case "claim_implementer": {
      const { task_id, agent_name = "Implementer Agent" } = args;
      const candidates = [
        path.join(COMMIT_TASKS_DIR, task_id.endsWith(".md") ? task_id : `${task_id}.md`),
        path.join(DOCS_TASKS_DIR, task_id.endsWith(".md") ? task_id : `${task_id}.md`),
      ];

      let foundPath = "";
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          foundPath = c;
          break;
        }
      }

      if (!foundPath) {
        return {
          content: [{ type: "text", text: `❌ Task '${task_id}' not found to claim.` }],
        };
      }

      let content = fs.readFileSync(foundPath, "utf8");
      const timestamp = new Date().toISOString();

      if (/STATUS:\s*\w+/i.test(content)) {
        content = content.replace(/STATUS:\s*\w+/i, "STATUS: in_progress");
      } else {
        content += `\nSTATUS: in_progress\n`;
      }
      content += `CLAIMED_BY: ${agent_name}\nCLAIMED_AT: ${timestamp}\n`;

      fs.writeFileSync(foundPath, content, "utf8");

      // --- B-3: Push claim status immediately so Analyzer can see it ---
      const relPath = foundPath.replace(REPO + "/", "");
      const pushResult = safeExec(
        `git add "${relPath}" && git commit -m "chore(pipeline): claim ${task_id} by ${agent_name}" && git push -q origin HEAD`
      );
      const pushed = !pushResult.includes("error") && !pushResult.includes("Error");

      const targetBranch = `ai/fix-${task_id.replace(/^TASK_/, "").toLowerCase()}`;
      return {
        content: [
          {
            type: "text",
            text: [
              `✅ Task \`${path.basename(foundPath)}\` claimed by **${agent_name}**!`,
              `- Status: **in_progress**`,
              `- Claimed at: ${timestamp}`,
              `- GitHub sync: ${pushed ? "✅ pushed immediately" : "⚠️ local only — watcher will sync shortly"}`,
              ``,
              `**Next steps:**`,
              `1. Write your solution files to \`commit/inbox/\``,
              `2. Run: \`bash scripts/push-commit.sh --pr ${task_id}\``,
              `   → Creates branch \`${targetBranch}\` and opens a PR automatically`,
            ].join("\n"),
          },
        ],
      };
    }

    case "get_pending_reviews": {
      let prOutput = "";
      const token = getGithubToken();

      if (token) {
        try {
          const res = execSync(
            `curl -s -H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/Muath-Yousef/Root_Planner/pulls?state=open"`,
            { encoding: "utf8" }
          );
          const prs = JSON.parse(res);
          if (Array.isArray(prs) && prs.length > 0) {
            prOutput = prs
              .map(
                (p) =>
                  `- **PR #${p.number}**: [${p.title}](${p.html_url}) (Branch: \`${p.head.ref}\` by ${p.user.login})`
              )
              .join("\n");
          }
        } catch {}
      }

      // Check local ai/ branches
      const aiBranches = safeExec("git branch -a | grep 'ai/'") || "";

      // Check review notes in commit/reviews/
      const localReviews = fs.existsSync(COMMIT_REVIEWS_DIR)
        ? fs.readdirSync(COMMIT_REVIEWS_DIR).filter((f) => f.endsWith(".md"))
        : [];

      let report = "### 🔍 Review Queue & PR Status\n\n";
      if (prOutput) {
        report += `**Open Pull Requests on GitHub:**\n${prOutput}\n\n`;
      } else {
        report += "**Open Pull Requests on GitHub:** None currently open.\n\n";
      }

      if (aiBranches) {
        report += `**Active AI Branches:**\n\`\`\`\n${aiBranches}\n\`\`\`\n\n`;
      }

      if (localReviews.length > 0) {
        report += `**Queued Local Reviews in commit/reviews/:** ${localReviews.join(", ")}\n`;
      }

      report += `\n*Reviewers can evaluate diffs and submit verdicts using \`submit_review_note\`.*`;

      return {
        content: [{ type: "text", text: report }],
      };
    }

    case "submit_review_note": {
      const { pr_or_branch, verdict, notes, suggested_fixes = "" } = args;
      const now = new Date();
      const filename = `REVIEW_${pr_or_branch}_${now.toISOString().replace(/[-:T.]/g, "").slice(0, 14)}.md`;
      const targetPath = path.join(COMMIT_REVIEWS_DIR, filename);

      const reviewContent = `# Code Review: ${pr_or_branch}
TARGET: ${pr_or_branch}
VERDICT: ${verdict.toUpperCase()}
DATE: ${now.toISOString()}

## Feedback & Analysis
${notes}

${suggested_fixes ? `## Suggested Fixes / Code Diff\n${suggested_fixes}\n` : ""}
`;

      fs.writeFileSync(targetPath, reviewContent, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `✅ Review note successfully submitted!\n- **Target:** \`${pr_or_branch}\`\n- **Verdict:** \`${verdict.toUpperCase()}\`\n- **File:** \`commit/reviews/${filename}\`\n\nThe local watcher will sync this to \`docs/pipeline/reviews/\` on GitHub.`,
          },
        ],
      };
    }

    case "get_pipeline_status": {
      const branch = safeExec("git rev-parse --abbrev-ref HEAD");
      const gitLog = safeExec("git log --oneline -5");
      const watcherStatus = safeExec("systemctl --user is-active root-planner-watcher.service") || "unknown";

      const pendingTasksCount = fs.readdirSync(COMMIT_TASKS_DIR).filter((f) => f.endsWith(".md")).length;
      const syncedTasksCount = fs.existsSync(DOCS_TASKS_DIR)
        ? fs.readdirSync(DOCS_TASKS_DIR).filter((f) => f.endsWith(".md")).length
        : 0;

      const statusText = `## 📊 AI Pipeline Operational Overview

| Metric | Status |
|--------|--------|
| **Current Git Branch** | \`${branch}\` |
| **Watcher Service** | \`${watcherStatus}\` |
| **Queued Tasks (commit/tasks/)** | \`${pendingTasksCount}\` |
| **Synced Tasks (docs/pipeline/tasks/)** | \`${syncedTasksCount}\` |
| **Roles Specification** | \`.github/AGENT_ROLES.md\` (Active) |

### Recent Commits:
\`\`\`
${gitLog}
\`\`\`
`;
      return {
        content: [{ type: "text", text: statusText }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool name: ${name}` }],
      };
  }
});

// --- B-5: Graceful Shutdown ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`✅ Pipeline MCP Server v2.0 running (PID: ${process.pid})`);
}

const shutdown = async (signal) => {
  console.error(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  try { await server.close(); } catch (_) {}
  process.exit(0);
};

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("💥 Fatal startup error:", err);
  process.exit(1);
});
