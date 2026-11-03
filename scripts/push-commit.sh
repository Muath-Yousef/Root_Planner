#!/usr/bin/env bash
# push-commit.sh: Automatically routes files placed in <repo>/commit into their
# proper project locations, runs validation checks, and commits & pushes to GitHub.
# Processed files are archived to commit/.done/<timestamp>/.
#
# Usage:
#   ./scripts/push-commit.sh              Process inbox once and exit
#   ./scripts/push-commit.sh --watch      Run interactively in foreground
#   ./scripts/push-commit.sh --start      Start background daemon watcher
#   ./scripts/push-commit.sh --stop       Stop background daemon watcher
#   ./scripts/push-commit.sh --status     Check status of background daemon
#   ./scripts/push-commit.sh --service    Install & enable systemd user service
#   ./scripts/push-commit.sh --dry-run    Show destination for each file without moving
#
# Options:
#   -m "message"    Custom commit message
#   -b <branch>     Push to specified branch (default: current branch)
#   --no-check      Skip typecheck (tsc) and unit tests
#   --no-scan       Skip sensitive credentials scan
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DEFAULT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "/home/kyrie/work/Root_Planner/Root_Planner")"
REPO="${REPO:-$REPO_DEFAULT}"
REMOTE="${REMOTE:-origin}"
INBOX="$REPO/commit"
DONE="$INBOX/.done"
PID_FILE="$REPO/.git/push-commit.pid"
LOG_FILE="$REPO/.git/push-commit.log"

WATCH=0; DRY=0; CHECK=1; SCAN=1; BRANCH=""; MSG=""
ACTION=""

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

# Where a file goes. A file inside a subfolder of commit/ keeps that path (commit/src/engine/x.ts -> src/engine/x.ts).
# A flat file is routed by name.
route() {
  local rel="$1" base
  base="$(basename "$rel")"
  if [[ "$rel" == */* ]]; then echo "$rel"; return; fi
  case "$base" in
    README.md|MASTER_REFERENCE*.md|package.json|package-lock.json|tsconfig.json|vite.config.ts|index.html) echo "$base" ;;
    *.test.ts|*.test.tsx)                echo "tests/$base" ;;
    *.schema.json)                       echo "src/schemas/$base" ;;
    *PROMPT*.md|*prompt*.md|UX_*.md)     echo "docs/prompts/$base" ;;
    *.md)                                echo "docs/$base" ;;
    *.sh)                                echo "scripts/$base" ;;
    *.ts|*.tsx|*.css)                    echo "src/$base" ;;
    *)                                   echo "docs/inbox/$base" ;;
  esac
}

# Files that must never be pushed
blocked() {
  local rel="$1" base
  base="$(basename "$rel")"
  [[ "$rel" == /* || "$rel" == *..* || "$rel" == node_modules/* || "$rel" == .git/* ]] && return 0
  case "$base" in
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|id_rsa*|id_ed25519*|credentials.json) return 0 ;;
  esac
  return 1
}

leaks_secret() {
  (( SCAN )) || return 1
  grep -IEq 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----' "$1" 2>/dev/null
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
  done < <(find "$INBOX" -type f ! -path "$DONE/*" ! -name '.gitkeep' ! -name '.DS_Store' ! -name '*.swp' ! -name '*~' -print0 2>/dev/null | sort -z)

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
    dest="$(route "$rel")"
    echo "  ➡️  $rel  ->  $dest"
    rels+=("$rel")
    dests+=("$dest")
  done

  (( ${#dests[@]} )) || { echo "Nothing valid to push."; return 0; }
  if (( DRY )); then
    echo "Dry run complete: no changes made."
    return 0
  fi

  # Branch handling
  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ -n "$BRANCH" ]] && [[ "$BRANCH" != "$current_branch" ]]; then
    git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH"
    current_branch="$BRANCH"
  fi

  echo "🔄 Pulling latest changes from $REMOTE/$current_branch..."
  git pull --rebase --autostash -q "$REMOTE" "$current_branch" 2>/dev/null || true

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
        return 1
      fi
      echo "✅ Pre-push checks passed."
    fi

    local names
    names="$(printf '%s, ' "${dests[@]##*/}")"
    names="${names%, }"
    local commit_msg="${MSG:-chore: update ${#dests[@]} file(s) from inbox: ${names:0:100}}"
    git commit -q -m "$commit_msg"
    echo "🚀 Pushing commit to $REMOTE/$current_branch..."
    if ! git push -q -u "$REMOTE" HEAD; then
      echo "❌ PUSH FAILED: Commit saved locally. Check network or remote permissions." >&2
      return 1
    fi
    echo "✅ Successfully pushed commit: $(git log -1 --format='%h %s')"
  fi

  # Archive processed files
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  for i in "${!rels[@]}"; do
    mkdir -p "$(dirname "$DONE/$stamp/${rels[$i]}")"
    mv -f -- "$INBOX/${rels[$i]}" "$DONE/$stamp/${rels[$i]}"
  done
  find "$INBOX" -mindepth 1 -type d ! -path "$DONE*" -empty -delete 2>/dev/null || true
  echo "📁 Files archived to commit/.done/$stamp/"
}

# Concurrency lock
mkdir -p "$REPO/.git" 2>/dev/null || true
exec 9>"$REPO/.git/push-commit.lock"
if ! flock -n 9; then
  echo "Another push-commit instance is currently running."
  exit 0
fi

watch_loop() {
  echo "👀 Watching $INBOX for files (PID: $$)..."
  while true; do
    # Check if there are files
    local count
    count="$(find "$INBOX" -type f ! -path "$DONE/*" ! -name '.gitkeep' ! -name '.DS_Store' ! -name '*.swp' 2>/dev/null | wc -l)"
    if (( count > 0 )); then
      sleep 1
      process_once || echo "⚠️ Warning: Processing failed, will retry on next change" >&2
    fi

    # Event wait
    if command -v inotifywait >/dev/null 2>&1; then
      inotifywait -qq -r -e close_write,moved_to,create --exclude '/\.done/' "$INBOX" 2>/dev/null || sleep 2
    elif command -v python3 >/dev/null 2>&1; then
      python3 -c "
import os, select, sys, ctypes
try:
    libc = ctypes.CDLL(None)
    libc.inotify_init.restype = ctypes.c_int
    libc.inotify_add_watch.restype = ctypes.c_int
    libc.inotify_add_watch.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_uint32]
    fd = libc.inotify_init()
    if fd >= 0:
        p = sys.argv[1].encode('utf-8')
        libc.inotify_add_watch(fd, p, 0x00000008 | 0x00000080 | 0x00000100)
        poll = select.poll()
        poll.register(fd, select.POLLIN)
        poll.poll(3000)
        os.close(fd)
except Exception:
    import time; time.sleep(2)
" "$INBOX" 2>/dev/null || sleep 2
    else
      sleep 2
    fi
  done
}

if (( WATCH )); then
  watch_loop
else
  process_once
fi
