# Report B — Git workflow infra (part B): namespaced agent-report paths + push-immediately / draft-PR workflow

**Branch:** `feature/git-workflow-infra-b` (cut from `main`) · **Date:** 2026-09-14
**Implements:** RESEARCH_REPORT.md findings **Q1** (branching-model confirmation),
**Q4** (push-immediately + draft-PR-per-task), and **Q5** (report-filename-collision
structural fix).

Part A (branch `feature/git-workflow-infra-a`, separate worktree) implements Q2/Q3
(`scripts/git-safety-checks.sh` pre-push-gate, `.githooks/`, package.json) and is not
touched here. Both branches merge together afterward.

## What changed and why

### `TEAM_DISPATCH_PROTOCOL.md`

1. **New section "Report Artifacts: Namespaced Paths"** (before the dispatch
   template): every agent writes `REPORT.md` / `SELF_REVIEW.md` /
   `RESEARCH_REPORT.md` under `docs/agent-reports/<task-slug>/` (slug = branch name's
   task identifier), never at the worktree root. Documents *why* — the empirically
   confirmed finding that `.gitattributes merge=ours` does not resolve add/add
   conflicts, and that `-X ours` discards one side wholesale — so future sessions
   don't reintroduce root-level reports. (Q5.)
2. **Dispatch template updated**: CONTEXT now carries a "Report slug" line;
   template gains a mandatory **REPORTS** block listing the three namespaced
   deliverable paths; DO NOT list forbids root-level report writes; DONE WHEN
   requires reports under the namespaced path. (Q5, applied to the actual template.)
3. **New section "Task Lifecycle Step: Push Branch + Open Draft PR (immediately
   after COMPLETE)"**: the standard lifecycle now has a step — as soon as a task is
   COMPLETE and committed, (i) `git push -u origin <branch-N>`, then (ii)
   `gh pr create --draft --title "[<task-id>] <short title>" --body "..."` with the
   DISPATCH_BRIEF.md acceptance criteria copied verbatim into the body. Documents the
   exact `gh pr create` invocation (flags verified against installed `gh` 2.92.0:
   `-d/--draft`, `-t/--title`, `-b/--body`). Rationale: GitHub becomes the audit
   trail and diff-review surface from the start, not reconstructed after the fact.
   (Q4.)
4. **New section "Push Discipline: Never Batch Pushes of Merged Work"**: after any
   local merge of a task branch into main/integration, push that integration branch
   immediately; do not batch multiple merges before one push. Points to
   `scripts/git-safety-checks.sh pre-push-gate` (part A's script) as the pre-push
   check, with the equivalent `git merge-base --is-ancestor origin/main main` one-liner
   as fallback until it lands. (Q2/Q1.)
5. **Review Checklist** extended: verify reports live under
   `docs/agent-reports/<task-slug>/` and that the branch was pushed + draft PR opened.
6. **Phase 2 parallel-execution example (T₂)** updated: per-task draft PRs already
   opened at T₁ become the review surface; integration branch pushed immediately after
   merge, gated by the pre-push gate; drafts marked ready/merged/closed. (Q4/Q2.)

### `DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md`

- Section 2's verbatim dispatch-brief text now includes the report-path instruction
  (`docs/agent-reports/<task-slug>/`, never worktree root) — additive, does not
  change the worktree-per-team or pinned-base-SHA mechanics.
- New **Section 5** cross-references both conventions: 5.1 namespaced report paths
  (why, and that slug == branch identifier); 5.2 push discipline (push branch +
  draft PR after COMPLETE; push main immediately after each merge, gated by
  `scripts/git-safety-checks.sh pre-push-gate`). Explicitly notes these add to, and
  do not contradict, Sections 1–3.

### `docs/agent-reports/README.md` (new)

Documents the `docs/agent-reports/<task-slug>/` convention: what goes there, why
(add/add conflict across parallel branches; `.gitattributes merge=ours` empirically
does not fix add/add; `-X ours` discards a side), and a worked example path.

### Phase 3 report migration (the demonstration)

Moved today's already-merged Phase 3 reports into the new convention with `git mv`
(history preserved; all recorded as `R` renames):

```
REPORT_3A.md                              → docs/agent-reports/phase-3a-ai-service/REPORT.md
SELF_REVIEW_3A.md                         → docs/agent-reports/phase-3a-ai-service/SELF_REVIEW.md
REPORT_3B.md                              → docs/agent-reports/phase-3b-frontend-auth/REPORT.md
SELF_REVIEW_3B.md                         → docs/agent-reports/phase-3b-frontend-auth/SELF_REVIEW.md
REPORT_3D.md                              → docs/agent-reports/phase-3d-error-standardization/REPORT.md
SELF_REVIEW_3D.md                         → docs/agent-reports/phase-3d-error-standardization/SELF_REVIEW.md
```

Task 3C has no tracked report files: verified via
`git log --all --oneline -- '*3C*' '*3c*'` (no results) and the `--name-status`
history of `*REPORT*`/`*SELF_REVIEW*` (only 3A/3B/3D files ever existed), so there
was nothing to move for it.

## Self-vetting performed

- Read the actual current content of `TEAM_DISPATCH_PROTOCOL.md` and
  `DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md` before editing; matched their existing
  section structure (`##`/`###`, code blocks, checklist style).
- Confirmed via `git log --all --oneline -- '*REPORT*' '*SELF_REVIEW*'` and
  `git ls-files` which report files exist before running `git mv` (6 files, all
  present; 3C absent).
- Verified `gh pr create` flags against installed CLI `gh` 2.92.0
  (`gh pr create --help`): `-d/--draft`, `-t/--title`, `-b/--body` all present.
- No application code touched (`client/`, `server/`, `shared/` untouched); no
  `scripts/git-safety-checks.sh`, `.githooks/`, or `package.json` changes (part A's
  scope).