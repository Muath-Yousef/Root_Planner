#!/usr/bin/env bash
# pipeline-status.sh: Interactive or one-shot status report for the Root Planner AI Pipeline.
# Usage: ./scripts/pipeline-status.sh [--watch]

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_status() {
  clear 2>/dev/null || true
  echo -e "${BLUE}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}${BOLD}  🤖 Root Planner AI Multi-Agent Pipeline Operational Status   ${NC}"
  echo -e "${BLUE}${BOLD}═════════════════════════════════════════════════════════════════${NC}"

  # 1. Watcher Service Status
  if systemctl --user is-active --quiet root-planner-watcher.service 2>/dev/null; then
    WATCHER_PID=$(systemctl --user show --property MainPID root-planner-watcher.service 2>/dev/null | cut -d= -f2)
    echo -e "  Watcher Service:       ${GREEN}● ACTIVE${NC} (Systemd PID: ${WATCHER_PID:-unknown})"
  elif [[ -f "$REPO/.git/push-commit.pid" ]] && kill -0 "$(cat "$REPO/.git/push-commit.pid")" 2>/dev/null; then
    echo -e "  Watcher Service:       ${GREEN}● ACTIVE${NC} (Daemon PID: $(cat "$REPO/.git/push-commit.pid"))"
  else
    echo -e "  Watcher Service:       ${RED}● STOPPED${NC} (Run: systemctl --user start root-planner-watcher)"
  fi

  # 2. Git & Branch Info
  local branch last_commit remote_url
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  last_commit="$(git log -1 --format='%h - %s (%cr)' 2>/dev/null || echo 'none')"
  remote_url="$(git remote get-url origin 2>/dev/null || echo 'none')"

  echo -e "  Current Branch:        ${CYAN}${branch}${NC}"
  echo -e "  Remote Origin:         ${remote_url}"
  echo -e "  Latest Commit:         ${last_commit}"

  # 3. Queues & Task Metrics
  local inbox_pending tasks_queued tasks_synced in_progress reviews_queued reviews_synced failed_pushes
  inbox_pending=$(find "$REPO/commit/inbox" -type f ! -name '.gitkeep' ! -name '.DS_Store' 2>/dev/null | wc -l)
  tasks_queued=$(find "$REPO/commit/tasks" -type f ! -name '.gitkeep' ! -name '.DS_Store' 2>/dev/null | wc -l)
  tasks_synced=$(find "$REPO/docs/pipeline/tasks" -type f -name '*.md' 2>/dev/null | wc -l)
  in_progress=$(grep -rli "STATUS:\s*in_progress" "$REPO/docs/pipeline/tasks" "$REPO/commit/tasks" 2>/dev/null | wc -l)
  reviews_queued=$(find "$REPO/commit/reviews" -type f ! -name '.gitkeep' ! -name '.DS_Store' 2>/dev/null | wc -l)
  reviews_synced=$(find "$REPO/docs/pipeline/reviews" -type f -name '*.md' 2>/dev/null | wc -l)
  failed_pushes=$(find "$REPO/commit/.done/failed" -type f -name 'PUSH_FAILURE.txt' 2>/dev/null | wc -l)

  echo ""
  echo -e "${BOLD}  📊 Queue & Workflow Metrics:${NC}"
  echo -e "  - Code Inbox Pending:  ${YELLOW}${inbox_pending}${NC} files awaiting push"
  echo -e "  - Tasks (Queued/Local):${YELLOW}${tasks_queued}${NC} files in commit/tasks/"
  echo -e "  - Tasks (Synced):      ${GREEN}${tasks_synced}${NC} in docs/pipeline/tasks/"
  echo -e "  - Tasks (In Progress): ${CYAN}${in_progress}${NC} claimed by implementer"
  echo -e "  - Review Notes:        ${reviews_queued} queued / ${reviews_synced} synced"

  if (( failed_pushes > 0 )); then
    echo -e "  - Push Failures:       ${RED}${BOLD}⚠️  ${failed_pushes} failure report(s) in commit/.done/failed/${NC}"
  else
    echo -e "  - Push Failures:       ${GREEN}0 (Clean)${NC}"
  fi

  # 4. Open PRs & Active AI branches
  echo ""
  echo -e "${BOLD}  🌿 Active AI Branches & Pull Requests:${NC}"
  local ai_branches
  ai_branches=$(git branch --list 'ai/*' 2>/dev/null || true)
  if [[ -n "$ai_branches" ]]; then
    echo "$ai_branches" | sed 's/^/    /'
  else
    echo "    (No local ai/* branches)"
  fi

  if command -v gh >/dev/null 2>&1; then
    local prs
    prs=$(gh pr list --state open --limit 5 2>/dev/null || true)
    if [[ -n "$prs" ]]; then
      echo ""
      echo -e "    ${BOLD}Open GitHub PRs:${NC}"
      echo "$prs" | sed 's/^/    /'
    fi
  fi

  echo -e "${BLUE}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
}

if [[ "${1:-}" == "--watch" ]]; then
  while true; do
    print_status
    sleep 3
  done
else
  print_status
fi
