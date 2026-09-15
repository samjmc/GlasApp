#!/usr/bin/env bash
set -euo pipefail

REPO="$( cd "$(dirname "$0")/.." && pwd )"
cd "$REPO"
BRANCH_PREFIX="${BRANCH_PREFIX:-feature}"
DRY_RUN="${DRY_RUN:-1}"

die() { echo "auto-land: FATAL: $*" >&2; exit 1; }
log() { echo "auto-land: $*"; }

# Preflight
[ "$(git rev-parse --show-toplevel)" = "$REPO" ] || die "run from canonical repo, not a worktree"
[ -z "$(git status --porcelain)" ] || die "main working tree is dirty — clean it first"
git fetch origin >/dev/null 2>&1 || true
git merge-base --is-ancestor origin/main main >/dev/null 2>&1 || die "main diverged from origin/main"

# Baseline (relative tsc gate, §6.1)
log "Capturing tsc baseline..."
npx tsc --noEmit 2>&1 | grep 'error TS' | sort > /tmp/errors-main.$$ || true
baseline_count=$(wc -l < /tmp/errors-main.$$)
log "Baseline: $baseline_count errors"

ready_branches=()
skipped_branches=()
merged_branches=()

# Discover and gate
log "Scanning branches..."
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/$BRANCH_PREFIX/* 2>/dev/null || true); do
  git rev-parse --verify "$b^{commit}" >/dev/null 2>&1 || continue
  
  # Already merged?
  if git merge-base --is-ancestor "$b" main 2>/dev/null; then
    merged_branches+=("$b")
    continue
  fi
  
  # Has commits ahead?
  ahead=$(git rev-list --count main.."$b" 2>/dev/null || echo 0)
  [ "$ahead" -gt 0 ] || continue
  
  # Worktree clean?
  wt_path=$(git worktree list --porcelain 2>/dev/null | grep -F "$b" | awk '{print $1}' || true)
  if [ -n "$wt_path" ]; then
    [ -z "$(git -C "$wt_path" status --porcelain 2>/dev/null || true)" ] || { log "$b: worktree dirty"; skipped_branches+=("$b"); continue; }
  fi
  
  # No merge conflicts?
  if ! scripts/git-safety-checks.sh merge-dry-run main "$b" 2>/dev/null; then
    log "$b: CONFLICT skipped"
    skipped_branches+=("$b")
    continue
  fi
  
  # Relative tsc gate (no new errors)
  b_safe=$(echo "$b" | tr '/' '-')
  branch_errors="/tmp/errors-branch-$b_safe.$$"
  if [ -n "$wt_path" ]; then
    tsc_output=$(git -C "$wt_path" rev-parse --show-toplevel 2>/dev/null)
    npx tsc --noEmit --project "$tsc_output" 2>&1 | grep 'error TS' | sort > "$branch_errors" || true
  else
    npx tsc --noEmit 2>&1 | grep 'error TS' | sort > "$branch_errors" || true
  fi
  new_errors=$(comm -23 "$branch_errors" /tmp/errors-main.$$ | wc -l)
  rm -f "$branch_errors"
  if [ "$new_errors" -gt 0 ]; then
    log "$b: CHECK_FAILED ($new_errors new errors)"
    skipped_branches+=("$b")
    continue
  fi
  
  ready_branches+=("$b")
done

# Merge + push
if [ ${#ready_branches[@]} -gt 0 ]; then
  log "Ready branches: ${#ready_branches[@]}"
  for b in "${ready_branches[@]}"; do
    log "Merging $b..."
    if ! git merge --ff-only "$b" 2>/dev/null; then
      git merge --no-ff -m "Merge $b into main (auto-land)" "$b" 2>/dev/null || { log "$b: MERGE_FAILED"; continue; }
    fi
    
    # ff-safety check (helper-level)
    if ! scripts/git-safety-checks.sh pre-push-gate >/dev/null 2>&1; then
      git merge --abort 2>/dev/null || true
      log "$b: ff-safety check failed"
      continue
    fi
    
    # Push with bypass
    if [ "$DRY_RUN" = "0" ]; then
      if LOOP_AUTO_PUSH=1 git push origin main 2>/dev/null; then
        log "$b: merged and pushed"
        git branch -d "$b" 2>/dev/null || true
      else
        log "$b: push failed (next pass will retry)"
      fi
    else
      log "$b: [DRY_RUN] would merge and push"
    fi
  done
else
  log "No ready branches found"
fi

# Cleanup merged branches
if [ ${#merged_branches[@]} -gt 0 ]; then
  log "Cleaning up ${#merged_branches[@]} already-merged branches..."
  for b in "${merged_branches[@]}"; do
    git branch -d "$b" 2>/dev/null || true
    git worktree remove "$b" 2>/dev/null || true
  done
fi

# Report
log "Summary:"
log "  Ready: ${#ready_branches[@]}"
log "  Skipped: ${#skipped_branches[@]}"
log "  Cleaned up: ${#merged_branches[@]}"
[ ${#skipped_branches[@]} -eq 0 ] || log "  Manual intervention needed: ${skipped_branches[*]}"

rm -f /tmp/errors-main.$$ /tmp/errors-branch.$$ 2>/dev/null || true
exit 0