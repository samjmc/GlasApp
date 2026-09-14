#!/usr/bin/env bash
# auto-land.sh — automated merge+push for "clean and ready" branches
# Implements RESEARCH_REPORT.md design: §5 (architecture), §6 (readiness), §7 (merge), §8 (error handling)
# Run from canonical repo by coordinator. Idempotent. Never run inside a worktree.
set -euo pipefail

REPO="$( cd "$(dirname "$0")/.." && pwd )"
cd "$REPO"
BRANCH_PREFIX="${BRANCH_PREFIX:-feature}"
DRY_RUN="${DRY_RUN:-0}"

die() { echo "auto-land: FATAL: $*" >&2; exit 1; }
log() { echo "auto-land: $*"; }

# --- PREFLIGHT ---
log "Preflight checks..."
[ "$(git rev-parse --show-toplevel)" = "$REPO" ] || die "run from canonical repo, not a worktree"
[ -z "$(git status --porcelain)" ] || die "main working tree is dirty ($(git status --porcelain | wc -l) files) — clean it first"

log "Fetching origin..."
git fetch origin >/dev/null 2>&1 || die "fetch origin failed"

log "Checking fast-forward safety (main vs origin/main)..."
git merge-base --is-ancestor origin/main main >/dev/null 2>&1 || die "main diverged from origin/main (not a fast-forward)"

# --- TSC BASELINE (relative gate, §6.1) ---
log "Capturing tsc baseline for relative gate..."
baseline_file="/tmp/errors-main.$$"
npx tsc --noEmit 2>&1 | grep 'error TS' | sort > "$baseline_file" || true
baseline_count=$(wc -l < "$baseline_file")
log "Baseline: $baseline_count errors"

ready_branches=()
skipped_branches=()
merged_branches=()
merge_failed_branches=()

# --- DISCOVER & GATE BRANCHES ---
log "Scanning branches matching refs/heads/$BRANCH_PREFIX/*..."
for b in $(git for-each-ref --format='%(refname:short)' "refs/heads/$BRANCH_PREFIX/*" 2>/dev/null || true); do
  # §6.2: branch resolves
  git rev-parse --verify "$b^{commit}" >/dev/null 2>&1 || continue

  # §6.4: already merged?
  if git merge-base --is-ancestor "$b" main 2>/dev/null; then
    log "$b: already merged (queue cleanup)"
    merged_branches+=("$b")
    continue
  fi

  # §6.3: has commits ahead of main?
  ahead=$(git rev-list --count "main..$b" 2>/dev/null || echo 0)
  if [ "$ahead" -eq 0 ]; then
    log "$b: no commits ahead"
    continue
  fi

  # §6.5: worktree clean (if exists)
  wt_path=""
  if wt_line=$(git worktree list --porcelain 2>/dev/null | grep -F "$b" | head -1); then
    wt_path=$(echo "$wt_line" | awk '{print $1}')
    if [ -n "$wt_path" ] && [ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null || true)" ]; then
      log "$b: worktree dirty — skip"
      skipped_branches+=("$b")
      continue
    fi
  fi

  # §6.6: no merge conflicts
  if ! scripts/git-safety-checks.sh merge-dry-run main "$b" >/dev/null 2>&1; then
    log "$b: CONFLICT — skip"
    skipped_branches+=("$b")
    continue
  fi

  # §6.7: relative tsc gate (no new errors vs baseline)
  branch_file="/tmp/errors-branch-$b.$$.txt"
  npx tsc --noEmit 2>&1 | grep 'error TS' | sort > "$branch_file" || true
  new_errors=$(comm -23 "$branch_file" "$baseline_file" | wc -l)
  rm -f "$branch_file"
  if [ "$new_errors" -gt 0 ]; then
    log "$b: CHECK_FAILED ($new_errors new TS errors) — skip"
    skipped_branches+=("$b")
    continue
  fi

  log "$b: READY"
  ready_branches+=("$b")
done

# --- MERGE & PUSH READY BRANCHES ---
if [ ${#ready_branches[@]} -gt 0 ]; then
  log "Merging ${#ready_branches[@]} ready branch(es)..."
  for b in "${ready_branches[@]}"; do
    log "  → $b"

    # §7: merge strategy (fast-forward first, --no-ff fallback)
    if ! git merge --ff-only "$b" >/dev/null 2>&1; then
      if ! git merge --no-ff -m "Merge $b into main (auto-land)" "$b" >/dev/null 2>&1; then
        log "$b: MERGE_FAILED — skip"
        merge_failed_branches+=("$b")
        continue
      fi
      log "$b: merged via --no-ff"
    else
      log "$b: merged via fast-forward"
    fi

    # §4.1 + §5: ff-safety check (helper-level, before push)
    if ! scripts/git-safety-checks.sh pre-push-gate >/dev/null 2>&1; then
      log "$b: ff-safety check failed — aborting merge"
      git merge --abort 2>/dev/null || true
      merge_failed_branches+=("$b")
      continue
    fi

    # §4.1: push with LOOP_AUTO_PUSH=1 bypass
    if [ "$DRY_RUN" = "0" ]; then
      if LOOP_AUTO_PUSH=1 git push origin main >/dev/null 2>&1; then
        log "$b: ✓ merged and pushed to origin/main"
        # Cleanup: safe to delete after successful merge+push
        git branch -d "$b" 2>/dev/null || true
      else
        log "$b: push failed — main is committed locally, next pass will retry"
      fi
    else
      log "$b: [DRY_RUN] would merge+push (no action taken)"
    fi
  done
else
  log "No ready branches found"
fi

# --- CLEANUP ALREADY-MERGED BRANCHES ---
if [ ${#merged_branches[@]} -gt 0 ]; then
  log "Cleaning up ${#merged_branches[@]} already-merged branch(es)..."
  for b in "${merged_branches[@]}"; do
    git branch -d "$b" 2>/dev/null || log "$b: cleanup skipped (likely has unpushed commits)"
    git worktree remove "$b" 2>/dev/null || log "$b: worktree cleanup skipped"
  done
fi

# --- FINAL REPORT ---
log ""
log "=== RUN SUMMARY ==="
log "Ready (merged+pushed): ${#ready_branches[@]}"
log "Skipped (conflict/check_failed): ${#skipped_branches[@]}"
log "Merge failed: ${#merge_failed_branches[@]}"
log "Cleaned up (already merged): ${#merged_branches[@]}"

if [ ${#skipped_branches[@]} -gt 0 ]; then
  log "Manual intervention needed for: ${skipped_branches[*]}"
fi

if [ ${#merge_failed_branches[@]} -gt 0 ]; then
  log "Merge failed (may retry next pass): ${merge_failed_branches[*]}"
fi

# Cleanup temp files
rm -f "$baseline_file" 2>/dev/null || true

exit 0
