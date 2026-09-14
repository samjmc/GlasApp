#!/usr/bin/env bash
set -euo pipefail

# git-safety-checks.sh — scriptable git safety checks for GlasApp's multi-worktree,
# multi-agent dispatch pipeline. Implements Q2/Q3 findings from RESEARCH_REPORT.md:
#   - one-directional `git merge-base --is-ancestor` fast-forward checks
#   - `git merge-tree --write-tree` conflict oracle (dry-run, touches nothing)
# All subcommands exit 0 on "safe/clean" and non-zero on "unsafe/conflict", so they
# are directly usable in CI and git hooks.

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi

usage() {
  cat <<'EOF'
git-safety-checks.sh — scriptable git safety checks

Usage:
  git-safety-checks.sh ff-check <local-branch> <remote-ref>
      Exit 0 if <remote-ref> is an ancestor of <local-branch> (i.e. a plain push or
      fast-forward merge of <local-branch> over <remote-ref> is safe). Exit 1 if they
      have diverged. Prints a human-readable verdict either way.
      Primitive: git merge-base --is-ancestor <remote-ref> <local-branch>

  git-safety-checks.sh merge-dry-run <branch-a> <branch-b>
      Dry-run "would merging <branch-b> into <branch-a> conflict?" — detects conflicts
      without touching the working tree or creating any commit/ref. Prints the files
      that would conflict, if any. Exit 0 = clean, 1 = conflicts.
      Primitive: git merge-tree --write-tree --messages <branch-a> <branch-b>

  git-safety-checks.sh pre-push-gate
      Pre-push gate for the coordinator: fetch origin, then run ff-check main origin/main.
      Blocks (exit 1) if local main has diverged from origin/main. Intended to be run from
      the pre-push hook (see .githooks/pre-push) or manually before `git push origin main`.
      Override the checked refs with GATE_BRANCH (default: main) and GATE_REF
      (default: origin/<GATE_BRANCH>).

  git-safety-checks.sh        (no args) — print this usage and exit 1.
EOF
}

ff_check() {
  local local_branch=$1
  local remote_ref=$2

  if ! git rev-parse --verify --quiet "$local_branch" >/dev/null; then
    echo "ERROR: local branch '$local_branch' does not exist" >&2
    exit 2
  fi
  if ! git rev-parse --verify --quiet "$remote_ref^{commit}" >/dev/null; then
    echo "ERROR: remote ref '$remote_ref' does not exist (run: git fetch origin)" >&2
    exit 2
  fi

  if git merge-base --is-ancestor "$remote_ref" "$local_branch"; then
    local n
    n=$(git rev-list --count "$remote_ref..$local_branch")
    echo "safe to push: $local_branch is ahead of $remote_ref by $n commits, fast-forward"
    exit 0
  else
    echo "NOT SAFE: $remote_ref is not an ancestor of $local_branch — real divergence, do not push, investigate with"
    echo "  git log --oneline $remote_ref..$local_branch"
    echo "  git log --oneline $local_branch..$remote_ref"
    if git merge-base --is-ancestor "$local_branch" "$remote_ref"; then
      echo "hint: $local_branch is strictly behind $remote_ref (remote is ahead) — fetch and merge/rebase before pushing"
    fi
    exit 1
  fi
}

merge_dry_run() {
  local branch_a=$1
  local branch_b=$2

  if ! git rev-parse --verify --quiet "$branch_a^{commit}" >/dev/null; then
    echo "ERROR: branch '$branch_a' does not exist" >&2
    exit 2
  fi
  if ! git rev-parse --verify --quiet "$branch_b^{commit}" >/dev/null; then
    echo "ERROR: branch '$branch_b' does not exist" >&2
    exit 2
  fi

  local output status conflicts
  if output=$(git merge-tree --write-tree --messages "$branch_a" "$branch_b" 2>&1); then
    status=0
  else
    status=$?
  fi

  if [ "$status" -eq 0 ]; then
    echo "clean: merging $branch_b into $branch_a would succeed with no conflicts"
    exit 0
  elif [ "$status" -eq 1 ]; then
    conflicts=$(printf '%s\n' "$output" | sed -nE 's/^CONFLICT \([^)]*\): (Merge conflict in )?([^ ]+).*/\2/p' | sort -u)
    if [ -z "$conflicts" ]; then
      echo "CONFLICTS: merging $branch_b into $branch_a would conflict (could not parse per-file details)"
    else
      echo "CONFLICTS: merging $branch_b into $branch_a would conflict in:"
      printf '  - %s\n' "$conflicts"
    fi
    exit 1
  else
    echo "ERROR: git merge-tree failed with exit status $status" >&2
    exit "$status"
  fi
}

pre_push_gate() {
  local branch=${GATE_BRANCH:-main}
  local ref=${GATE_REF:-origin/$branch}

  echo "pre-push gate: fetching origin..."
  git fetch origin
  echo "pre-push gate: checking that $ref is an ancestor of $branch"
  ff_check "$branch" "$ref"
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi

case "$1" in
  ff-check)
    if [ $# -ne 3 ]; then
      echo "ERROR: ff-check expects exactly 2 args: <local-branch> <remote-ref>" >&2
      usage >&2
      exit 2
    fi
    ff_check "$2" "$3"
    ;;
  merge-dry-run)
    if [ $# -ne 3 ]; then
      echo "ERROR: merge-dry-run expects exactly 2 args: <branch-a> <branch-b>" >&2
      usage >&2
      exit 2
    fi
    merge_dry_run "$2" "$3"
    ;;
  pre-push-gate)
    if [ $# -ne 1 ]; then
      echo "ERROR: pre-push-gate expects no args" >&2
      usage >&2
      exit 2
    fi
    pre_push_gate
    ;;
  *)
    echo "ERROR: unknown subcommand '$1'" >&2
    usage >&2
    exit 2
    ;;
esac