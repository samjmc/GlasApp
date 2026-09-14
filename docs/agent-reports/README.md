# Agent Report Paths — `docs/agent-reports/<task-slug>/`

Every agent-generated delivery artifact lives under a per-task subdirectory of this
folder:

```
docs/agent-reports/<task-slug>/
```

`<task-slug>` is the branch name's task identifier in kebab-case. It is **required**
and derived from the branch/task name — the agent does not pick its own path.

## What goes here

Any report an agent produces while working a dispatch brief:

- `REPORT.md` — the task's delivery report (what changed, how each acceptance
  criterion was verified with the actual commands run, research findings, flagged
  risks).
- `SELF_REVIEW.md` — the agent's self-vetting pass, documented as findings + fixes.
- `RESEARCH_REPORT.md` — a standalone write-up of the mandatory pre-implementation
  research step, when one is produced.
- Any other agent-generated markdown artifact for that task.

Nothing agent-generated is written at the worktree root (no top-level `REPORT.md`,
`SELF_REVIEW.md`, etc.), and each task's files are always inside its own
`<task-slug>/` directory.

## Why (the structural reason, not just tidiness)

Parallel task branches are all cut from the same base commit, and each branch adds
its own `REPORT.md` / `SELF_REVIEW.md`. When those branches are later merged
together into `main`, every one of those identically-named files is an **add/add
conflict**: the file exists on both sides of the merge but in no common-ancestor
version.

No merge-attribute trick fixes this correctly:

- `.gitattributes merge=ours` does **not** auto-resolve an add/add conflict. The
  low-level merge driver needs a *base* version of the file to operate on, and an
  add/add file has none — so the merge still lands in a `UU` conflicted state.
  This was confirmed empirically in a throwaway scratch repo (two branches each
  adding `REPORT.md` with `merge=ours` in `.gitattributes` → still `UU`).
- `git merge -X ours` *does* resolve add/add, but only by **discarding the incoming
  side wholesale** — wrong when both reports are worth keeping.

Namespacing each task's reports under `docs/agent-reports/<task-slug>/` turns the
collision into a structural impossibility: two parallel branches can only collide
if they pick the same slug, and the slug is fixed to the branch/task identifier.

## One worked example

Branch `feature/phase-3a-ai-service` (task slug `phase-3a-ai-service`) produced
these files when merged:

```
docs/agent-reports/phase-3a-ai-service/REPORT.md
docs/agent-reports/phase-3a-ai-service/SELF_REVIEW.md
```

while the parallel branch `feature/phase-3b-frontend-auth` produced:

```
docs/agent-reports/phase-3b-frontend-auth/REPORT.md
docs/agent-reports/phase-3b-frontend-auth/SELF_REVIEW.md
```

Merging the two branches is conflict-free: no path overlaps, both reports survive.

## Notes

- Slug == branch's task identifier; keep both in lockstep (branch `feature/phase-N-task-M` → slug `phase-N-task-M`).
- If a report is throwaway, prefer keeping it git-ignored in the worktree instead of
  committing it at all — see `TEAM_DISPATCH_PROTOCOL.md` "Report Artifacts".
- Migrating historical reports: use `git mv` so history is preserved (this is how the
  Phase 3 reports were moved into this layout).