#!/usr/bin/env bash
# push-commit.sh: Automatically routes files placed in <repo>/commit into their
# proper project locations, runs validation checks, and commits & pushes to GitHub.
# Processed files are archived to commit/.done/<timestamp>/.
#
# Pipeline folder structure (AI Pipeline v2):
#   commit/inbox/    ← Implementer (Claude Code) writes code files here
#   commit/tasks/    ← Analyzer (Claude Desktop) writes task definitions here
#   commit/reviews/  ← Reviewer (any tool) writes review notes here
#   commit/.done/    ← Auto-archived after processing
#
# Legacy: files placed directly in commit/ (flat) are still processed (fallback).
#
# Usage:
#   ./scripts/push-commit.sh              Process all inboxes once and exit
#   ./scripts/push-commit.sh --watch      Run interactively in foreground
#   ./scripts/push-commit.sh --start      Start background daemon watcher
#   ./scripts/push-commit.sh --stop       Stop background daemon watcher
#   ./scripts/push-commit.sh --status     Check status of background daemon
#   ./scripts/push-commit.sh --service    Install & enable systemd user service
#   ./scripts/push-commit.sh --dry-run    Show destination for each file without moving
#
# Options:
#   -m "message"    Custom commit message
#   -b <branch>     Push to specified branch (creates it if needed; use ai/fix-* for PR workflow)
#   --no-check      Skip typecheck (tsc) and unit tests
#   --no-scan       Skip sensitive credentials scan
set -euo pipefail

# Ensure Node.js, NVM, and user binaries are in PATH
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  LATEST_NODE="$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
  if [[ -n "$LATEST_NODE" && -d "$HOME/.nvm/versions/node/$LATEST_NODE/bin" ]]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
  fi
fi
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DEFAULT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "/home/kyrie/work/Root_Planner/Root_Planner")"
REPO="${REPO:-$REPO_DEFAULT}"
REMOTE="${REMOTE:-origin}"
# Pipeline inbox directories (v2 structure)
INBOX_INBOX="$REPO/commit/inbox"    # Implementer: code files
INBOX_TASKS="$REPO/commit/tasks"    # Analyzer: task definitions
INBOX_REVIEWS="$REPO/commit/reviews" # Reviewer: review notes
INBOX_LEGACY="$REPO/commit"         # Legacy fallback (flat files in commit/)
INBOX="$INBOX_LEGACY"               # Primary used by process_once (see below)
DONE="$INBOX/.done"
PID_FILE="$REPO/.git/push-commit.pid"
LOG_FILE="$REPO/.git/push-commit.log"

WATCH=0; DRY=0; CHECK=1; SCAN=1; BRANCH=""; MSG=""
ACTION=""; PR_MODE=0; PR_TASK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch)          WATCH=1 ;;
    --start)          ACTION="start" ;;
    --stop)           ACTION="stop" ;;
    --status)         ACTION="status" ;;
    --service)        ACTION="service" ;;
    --dry-run)        DRY=1 ;;
    --no-check)       CHECK=0 ;;
    --no-scan)        SCAN=0 ;;
    --pr)             PR_MODE=1; PR_TASK="${2:-auto}"; shift ;;
    -b)               BRANCH="${2:?-b needs a branch name}"; shift ;;
    -m)               MSG="${2:?-m needs a message}"; shift ;;
    -h|--help)
      sed -n '2,17p' "$0" | tr -d '#'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- Daemon management commands ---
if [[ "$ACTION" == "status" ]]; then
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "🟢 Watcher is RUNNING (PID: $(cat "$PID_FILE"))"
    echo "Logs ($LOG_FILE):"
    tail -n 10 "$LOG_FILE" 2>/dev/null || true
  else
    echo "⚪ Watcher is NOT running."
    [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
  fi
  exit 0
fi

if [[ "$ACTION" == "stop" ]]; then
  if [[ -f "$PID_FILE" ]]; then
    PID="$(cat "$PID_FILE")"
    if kill -0 "$PID" 2>/dev/null; then
      echo "Stopping watcher daemon (PID: $PID)..."
      kill "$PID" 2>/dev/null || true
      sleep 1
      if kill -0 "$PID" 2>/dev/null; then kill -9 "$PID" 2>/dev/null || true; fi
      echo "Watcher stopped."
    else
      echo "Watcher was not running."
    fi
    rm -f "$PID_FILE"
  else
    echo "No watcher daemon PID file found."
  fi
  exit 0
fi

if [[ "$ACTION" == "start" ]]; then
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Watcher is already running (PID: $(cat "$PID_FILE"))."
    exit 0
  fi
  mkdir -p "$(dirname "$LOG_FILE")"
  nohup "$0" --watch >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "🚀 Watcher daemon started in background (PID: $!)."
  echo "📄 Logs: $LOG_FILE"
  echo "💡 Check status: $0 --status"
  echo "💡 Stop daemon:  $0 --stop"
  exit 0
fi

if [[ "$ACTION" == "service" ]]; then
  SYSTEMD_DIR="$HOME/.config/systemd/user"
  SERVICE_FILE="$SYSTEMD_DIR/root-planner-watcher.service"
  mkdir -p "$SYSTEMD_DIR"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Root Planner Auto-Commit Watcher
After=network.target

[Service]
Type=simple
Environment=PATH=$PATH
ExecStart=$SCRIPT_DIR/push-commit.sh --watch
WorkingDirectory=$REPO
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable root-planner-watcher.service
  systemctl --user restart root-planner-watcher.service
  echo "✅ Systemd user service installed and started!"
  echo "Status check: systemctl --user status root-planner-watcher.service"
  exit 0
fi

# Where a file goes. Supports pipeline subfolders:
#   commit/tasks/    -> docs/pipeline/tasks/
#   commit/reviews/  -> docs/pipeline/reviews/
#   commit/inbox/    -> routes to src/, tests/, docs/, etc. (or preserves subdirectory if structured)
# Flat legacy files in commit/ are routed according to standard rules.
route() {
  local rel="$1" base sub
  base="$(basename "$rel")"

  # Pipeline subfolders handling
  if [[ "$rel" == tasks/* ]]; then
    sub="${rel#tasks/}"
    echo "docs/pipeline/tasks/$sub"
    return
  fi
  if [[ "$rel" == reviews/* ]]; then
    sub="${rel#reviews/}"
    echo "docs/pipeline/reviews/$sub"
    return
  fi
  if [[ "$rel" == inbox/* ]]; then
    rel="${rel#inbox/}"
  fi

  if [[ "$rel" == */* ]]; then echo "$rel"; return; fi
  case "$base" in
    README.md|MASTER_REFERENCE*.md|package.json|package-lock.json|tsconfig.json|vite.config.ts|index.html) echo "$base" ;;
    *.test.ts|*.test.tsx)                echo "tests/$base" ;;
    *.schema.json)                       echo "src/schemas/$base" ;;
    *PROMPT*.md|*prompt*.md|UX_*.md)     echo "docs/prompts/$base" ;;
    *.md)                                echo "docs/$base" ;;
    *.sh)                                echo "scripts/$base" ;;
    *.ts|*.tsx|*.css)                    echo "src/$base" ;;
    *.patch|*.diff|*.zip|*.tar|*.tar.gz|*.tar.bz2|*.7z|*.rar) echo "SKIP" ;;
    *)                                   echo "docs/inbox/$base" ;;
  esac
}

# Files that must never be pushed
blocked() {
  local rel="$1" base
  base="$(basename "$rel")"
  [[ "$rel" == /* || "$rel" == *..* ]] && return 0
  [[ "$rel" =~ (^|/)(\.git|node_modules)(/|$) ]] && return 0
  case "$base" in
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|id_rsa*|id_ed25519*|credentials.json|*.secret|*.token) return 0 ;;
  esac
  return 1
}

file_too_large() {
  local f="$1"
  local max_bytes=10485760 # 10MB
  local size
  size=$(wc -c < "$f" 2>/dev/null || echo 0)
  (( size > max_bytes ))
}

leaks_secret() {
  (( SCAN )) || return 1
  grep -IEq 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----' "$1" 2>/dev/null && return 0
  grep -IEq 'AIza[0-9A-Za-z_-]{35}|sk-ant-[a-zA-Z0-9_\-]{20,}|sk-[a-zA-Z0-9]{32,}' "$1" 2>/dev/null && return 0
  return 1
}

cleanup_lock() {
  flock -u 9 2>/dev/null || true
  exec 9>&- 2>/dev/null || true
}

rollback() {
  local d
  for d in "$@"; do
    if git ls-files --error-unmatch -- "$d" >/dev/null 2>&1; then
      git checkout -q -- "$d"
    else
      rm -f -- "$d"
    fi
  done
}

process_once() {
  cd "$REPO"
  [[ -d .git ]] || { echo "Error: Not a git repository: $REPO" >&2; return 1; }
  mkdir -p "$INBOX" "$DONE"
  grep -qxF '/commit/' .git/info/exclude 2>/dev/null || echo '/commit/' >> .git/info/exclude

  local files=() f
  while IFS= read -r -d '' f; do
    files+=("$f")
  done < <(find "$INBOX" -type f ! -path "$DONE/*" ! -name '.gitkeep' ! -name 'INBOX_GUIDE.md' ! -name '.DS_Store' ! -name '*.swp' ! -name '*~' -print0 2>/dev/null | sort -z)

  if (( ${#files[@]} == 0 )); then
    if (( ! WATCH )); then
      echo "Inbox empty: $INBOX"
    fi
    return 0
  fi

  echo "📦 Found ${#files[@]} file(s) in inbox..."
  local rels=() dests=() rel dest
  for f in "${files[@]}"; do
    rel="${f#"$INBOX"/}"
    if blocked "$rel"; then
      echo "  ⚠️ SKIP (blocked name): $rel" >&2
      continue
    fi
    if leaks_secret "$f"; then
      echo "  ⚠️ SKIP (secret detected): $rel" >&2
      continue
    fi
    if file_too_large "$f"; then
      echo "  ⚠️ SKIP (file exceeds 10MB size limit): $rel" >&2
      continue
    fi
    dest="$(route "$rel")"
    if [[ "$dest" == "SKIP" ]]; then
      echo "  ⏭️  SKIP (unsupported type, left in commit/): $rel" >&2
      continue
    fi
    echo "  ➡️  $rel  ->  $dest"
    rels+=("$rel")
    dests+=("$dest")
  done

  (( ${#dests[@]} )) || { echo "Nothing valid to push."; return 0; }
  if (( DRY )); then
    echo "Dry run complete: no changes made."
    return 0
  fi

  # Acquire exclusive lock for committing and pushing
  exec 9>"$REPO/.git/push-commit.lock"
  if ! flock -n 9; then
    echo "Another commit task is currently running; skipping this run."
    return 0
  fi

  # --- B-2: PR Mode — create ai/fix-* branch automatically ---
  if (( PR_MODE )); then
    local auto_task="$PR_TASK"
    if [[ "$auto_task" == "auto" ]]; then
      auto_task=$(find "$INBOX/inbox" "$INBOX/tasks" -name "*.md" 2>/dev/null \
        | xargs grep -hoP 'TASK_REF:\s*\K\S+' 2>/dev/null | head -1 || true)
      [[ -z "$auto_task" ]] && auto_task="$(date +%Y%m%d%H%M%S)"
    fi
    local ai_branch="ai/fix-${auto_task,,}"
    echo "🌿 PR mode: switching to branch $ai_branch"
    git checkout -q "$ai_branch" 2>/dev/null || git checkout -q -b "$ai_branch"
    BRANCH="$ai_branch"
  fi

  # Branch handling
  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ -n "$BRANCH" ]] && [[ "$BRANCH" != "$current_branch" ]]; then
    git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH"
    current_branch="$BRANCH"
  fi

  echo "🔄 Pulling latest changes from $REMOTE/$current_branch..."
  if ! git pull --rebase --autostash -q "$REMOTE" "$current_branch" 2>/dev/null; then
    if [[ -d .git/rebase-merge || -d .git/rebase-apply ]]; then
      echo "⚠️ Git rebase conflict detected; aborting rebase to protect working tree." >&2
      git rebase --abort 2>/dev/null || true
    fi
  fi

  # Copy files to destination
  local i
  for i in "${!dests[@]}"; do
    mkdir -p "$(dirname "$REPO/${dests[$i]}")"
    cp -f -- "$INBOX/${rels[$i]}" "$REPO/${dests[$i]}"
  done

  git add -- "${dests[@]}"

  if git diff --cached --quiet; then
    echo "ℹ️  No changes against repository; archiving inbox files."
  else
    if (( CHECK )) && printf '%s\n' "${dests[@]}" | grep -qE '^(src|tests)/' && [[ -f package.json ]]; then
      echo "🔍 Running pre-push checks (tsc + tests)..."
      if ! { npx tsc --noEmit && npm test --silent; }; then
        git reset -q -- "${dests[@]}"
        rollback "${dests[@]}"
        echo "❌ CHECK FAILED: Typecheck or tests failed. Files remain in inbox for correction." >&2
        cleanup_lock
        return 1
      fi
      echo "✅ Pre-push checks passed."
    fi

    local names
    names="$(printf '%s, ' "${dests[@]##*/}")"
    names="${names%, }"
    local default_msg="chore: update ${#dests[@]} file(s) from inbox: ${names:0:100}"
    if printf '%s\n' "${dests[@]}" | grep -q '^docs/pipeline/tasks/'; then
      default_msg="docs(pipeline): task update: ${names:0:100}"
    elif printf '%s\n' "${dests[@]}" | grep -q '^docs/pipeline/reviews/'; then
      default_msg="docs(pipeline): review notes: ${names:0:100}"
    fi
    local commit_msg="${MSG:-$default_msg}"
    git commit -q -m "$commit_msg"

    # --- B-1: Retry State Machine — 3 attempts with failure tracking ---
    local push_ok=false
    local retry=0
    while (( retry < 3 )); do
      if git push -q -u "$REMOTE" HEAD; then
        push_ok=true
        break
      fi
      retry=$(( retry + 1 ))
      if (( retry < 3 )); then
        echo "⚠️  Push attempt $retry/3 failed, retrying in 10s..." >&2
        sleep 10
        git pull --rebase --autostash -q "$REMOTE" "$current_branch" 2>/dev/null || true
      fi
    done

    if $push_ok; then
      echo "✅ Successfully pushed commit: $(git log -1 --format='%h %s')"
      if (( PR_MODE )); then
        echo "🔀 PR branch pushed → GitHub Actions will open a PR automatically."
        echo "   Branch: $current_branch"
      fi
    else
      # Archive failure with full report (files stay in inbox for retry)
      local stamp_fail
      stamp_fail="$(date +%Y%m%d-%H%M%S)"
      local fail_dir="$DONE/failed/$stamp_fail"
      mkdir -p "$fail_dir"
      cat > "$fail_dir/PUSH_FAILURE.txt" << FAILEOF
TIMESTAMP: $stamp_fail
BRANCH: $current_branch
FILES: ${rels[*]}
LAST_COMMIT: $(git log -1 --format='%h %s' 2>/dev/null || echo "unknown")
GIT_STATUS: $(git status --short 2>/dev/null | head -10 || echo "unknown")
ACTION_REQUIRED: Check network, SSH keys, or remote permissions.
RETRY_COMMAND: cd "$REPO" && git push -u "$REMOTE" HEAD
FAILEOF
      for i in "${!rels[@]}"; do
        mkdir -p "$(dirname "$fail_dir/${rels[$i]}")"
        cp -f -- "$INBOX/${rels[$i]}" "$fail_dir/${rels[$i]}" 2>/dev/null || true
      done
      echo "❌ PUSH FAILED after 3 attempts. Report: $fail_dir/PUSH_FAILURE.txt" >&2
      echo "   Files kept in inbox for next retry." >&2
      cleanup_lock
      return 1
    fi
  fi

  # Archive processed files (only on success)
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  local done_success="$DONE/success/$stamp"
  for i in "${!rels[@]}"; do
    mkdir -p "$(dirname "$done_success/${rels[$i]}")"
    mv -f -- "$INBOX/${rels[$i]}" "$done_success/${rels[$i]}"
  done
  find "$INBOX" -mindepth 1 -type d ! -path "$DONE*" ! -path "$INBOX/tasks*" ! -path "$INBOX/inbox*" ! -path "$INBOX/reviews*" -empty -delete 2>/dev/null || true
  mkdir -p "$INBOX/tasks" "$INBOX/inbox" "$INBOX/reviews" 2>/dev/null || true
  echo "📁 Files archived to commit/.done/success/$stamp/"
  cleanup_lock
}

watch_loop() {
  echo "👀 Watching $INBOX for files (PID: $$)..."
  local last_trigger=0
  local DEBOUNCE_SECS=2

  while true; do
    # Check if there are files
    local count
    count="$(find "$INBOX" -type f ! -path "$DONE/*" ! -name '.gitkeep' ! -name 'INBOX_GUIDE.md' ! -name '.DS_Store' ! -name '*.swp' 2>/dev/null | wc -l)"
    if (( count > 0 )); then
      # --- A-2: Debounce — انتظر حتى تهدأ الكتابات المتتالية ---
      local now
      now=$(date +%s)
      local diff=$(( now - last_trigger ))
      if (( diff < DEBOUNCE_SECS )); then
        sleep $(( DEBOUNCE_SECS - diff + 1 ))
      else
        sleep 1
      fi
      process_once || echo "⚠️ Warning: Processing failed, will retry on next change" >&2
      last_trigger=$(date +%s)
    fi

    # --- A-1: Event wait — مراقبة عودية لكل الـ subfolders ---
    if command -v inotifywait >/dev/null 2>&1; then
      inotifywait -qq -r -e close_write,moved_to,create --exclude '/\.done/' "$INBOX" 2>/dev/null || sleep 2
    elif command -v python3 >/dev/null 2>&1; then
      python3 -c "
import os, select, sys, ctypes, time

try:
    libc = ctypes.CDLL(None)
    libc.inotify_init.restype = ctypes.c_int
    libc.inotify_add_watch.restype = ctypes.c_int
    libc.inotify_add_watch.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_uint32]
    fd = libc.inotify_init()
    if fd >= 0:
        IN_CLOSE_WRITE = 0x00000008
        IN_CREATE      = 0x00000100
        IN_MOVED_TO    = 0x00000080
        mask = IN_CLOSE_WRITE | IN_CREATE | IN_MOVED_TO
        root = sys.argv[1]
        # مراقبة عودية — كل subfolder بشكل صريح (A-1 fix)
        for dirpath, dirnames, _ in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != '.done']
            p = dirpath.encode('utf-8')
            libc.inotify_add_watch(fd, p, mask)
        poll = select.poll()
        poll.register(fd, select.POLLIN)
        poll.poll(3000)
        os.close(fd)
except Exception:
    time.sleep(2)
" "$INBOX" 2>/dev/null || sleep 2
    else
      sleep 2
    fi
  done
}

if (( DRY )); then
  process_once
  exit 0
fi

if (( WATCH )); then
  mkdir -p "$REPO/.git" 2>/dev/null || true
  exec 8>"$REPO/.git/push-commit-watcher.lock"
  if ! flock -n 8; then
    echo "Another watcher instance is already running."
    exit 0
  fi
  watch_loop
else
  process_once
fi
