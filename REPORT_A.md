# REPORT_A — scriptable git safety checks (Q2/Q3 implementation)

**Branch:** `feature/git-workflow-infra-a` · **Date:** 2026-09-14 · **Part:** A (Q2/Q3: scriptable safety checks + push discipline)

This worktree implements the Q2/Q3 findings of `RESEARCH_REPORT.md` (scriptable fast-forward
checks + push discipline) for GlasApp's multi-worktree, multi-agent dispatch pipeline. A parallel
agent on branch `feature/git-workflow-infra-b` (part B) owns Q1/Q4/Q5 (protocol docs + report-path
convention); the two branches are merged together afterward.

## What was built

| File | Purpose |
| --- | --- |
| `scripts/git-safety-checks.sh` | Self-documenting bash tool with three subcommands (below). All exit `0` on safe/clean and non-zero on unsafe/conflict, so it is usable in CI and hooks. |
| `.githooks/pre-push` | Minimal pre-push hook: `bash "$(git rev-parse --show-toplevel)/scripts/git-safety-checks.sh" pre-push-gate`, propagating its exit status. Committed under `.githooks/` (not `.git/hooks/`). |
| `package.json` | Added one entry only: `"git:safety-check": "bash scripts/git-safety-checks.sh"`. Nothing else touched. |

### Subcommands

- **`ff-check <local-branch> <remote-ref>`** — one-directional fast-forward check built on
  `git merge-base --is-ancestor <remote-ref> <local-branch>` (the Q3-recommended primitive).
  Exit `0` ⇒ `<remote-ref>` is an ancestor of `<local-branch>` (local ahead N commits, plain push /
  ff-merge is safe). Exit `1` ⇒ not an ancestor (diverged, or strictly behind — the script
  distinguishes the two and prints investigation commands either way). Exit `2` ⇒ usage/ref error.
- **`merge-dry-run <branch-a> <branch-b>`** — conflict oracle using the modern
  `git merge-tree --write-tree --messages` form (not the legacy 3-way textual form). Prints the
  files that would conflict; exit `1` on conflicts, `0` when clean. Touches nothing: no working-tree
  writes, no commits, no refs (verified — see below).
- **`pre-push-gate`** — fetches `origin`, then runs `ff-check main origin/main`; blocks (exit `1`)
  if local `main` has diverged. The checked refs can be overridden with `GATE_BRANCH` / `GATE_REF`
  env vars (defaults `main` / `origin/main`).

No args prints usage for all three subcommands and exits `1`.

## How to activate the hook (one-time, per maintainer machine)

```sh
git config core.hooksPath .githooks
```

That points this clone's hooks at the committed `.githooks/` directory, so the safety gate runs on
every `git push` without any machine-local copy. (Not wired into `.git/hooks/` here — that is local
machine config, not committable content.) Afterwards, `git push origin main` is blocked with exit 1
and a "NOT SAFE" verdict whenever local `main` has diverged from `origin/main`.

## Test methodology & results

All output below is real, captured from this session. Exit codes verified with `echo $?` after every
call. Scratch repos for destructive/conflict tests live in `/tmp`; no throwaway commits were created
in the GlasApp worktree.

### 1. `ff-check` — safe fast-forward (real GlasApp worktree)

Tested against the worktree's own branch vs. ancestor commits (including HEAD == branch tip):

```
$ bash scripts/git-safety-checks.sh ff-check feature/git-workflow-infra-a HEAD
safe to push: feature/git-workflow-infra-a is ahead of HEAD by 0 commits, fast-forward
exit=0

$ bash scripts/git-safety-checks.sh ff-check feature/git-workflow-infra-a 51f99c1
safe to push: feature/git-workflow-infra-a is ahead of 51f99c1 by 4 commits, fast-forward
exit=0
```

(The "4 commits" is correct: the range `51f99c1..HEAD` includes both parents of the intermediate
merge commit `5b87f9c`, which are reachable from HEAD but not from `51f99c1`.)

`ff-check main origin/main` also reported safe (`main` ahead by 42, later 69 after a fresh
`git fetch origin` inside the gate) — the real-world case from the research report now has a
single-command answer.

### 2. `ff-check` — NOT SAFE (true divergence, scratch repo in `/tmp/git-safety-scratch`)

Built a scratch repo: `base` commit, then `side-a` edits `shared.txt`, `side-b` edits the same file
differently from `base` — genuinely unrelated/diverged tips:

```
* 7731515 (side-a) side-a edits shared.txt
| * 0a85c71 (side-b) side-b edits shared.txt
|/
* ca544d6 (base) base commit
```

```
$ bash .../git-safety-checks.sh ff-check side-a side-b
NOT SAFE: side-b is not an ancestor of side-a — real divergence, do not push, investigate with
  git log --oneline side-b..side-a
  git log --oneline side-a..side-b
exit=1

$ bash .../git-safety-checks.sh ff-check side-b side-a     # symmetric
NOT SAFE: side-a is not an ancestor of side-b — real divergence, do not push, investigate with
  git log --oneline side-a..side-b
  git log --oneline side-b..side-a
exit=1
```

For the *strictly-behind* sub-case (no divergence, just remote ahead), the script exits 1 but adds
a corrective hint. Real example from this worktree (`feature/git-workflow-infra-b` is 1 commit ahead
of `feature/git-workflow-infra-a`, both cut from the same main):

```
$ bash scripts/git-safety-checks.sh ff-check feature/git-workflow-infra-a feature/git-workflow-infra-b
NOT SAFE: feature/git-workflow-infra-b is not an ancestor of feature/git-workflow-infra-a — real divergence, do not push, investigate with
  git log --oneline feature/git-workflow-infra-b..feature/git-workflow-infra-a
  git log --oneline feature/git-workflow-infra-a..feature/git-workflow-infra-b
hint: feature/git-workflow-infra-a is strictly behind feature/git-workflow-infra-b (remote is ahead) — fetch and merge/rebase before pushing
exit=1
```

Error/usage paths all exit `2` with a clear message (missing ref → "run: git fetch origin";
nonexistent branch; wrong arg count; unknown subcommand).

### 3. `merge-dry-run` — conflict detection (scratch repo)

Raw primitive first, to show what the script parses (`git merge-tree --write-tree --messages side-a
side-b`, git 2.50.1):

```
8d282c48a4634094c5ac72a7f7f52bbb52ffc6ce
100644 1523f2885e163cc42476113a185b33b5c5153793 1	shared.txt
100644 93b7b37080a7484469ebe0f0284d98d135bd85c2 2	shared.txt
100644 abe0e34b66c09171d1af36e052361b2581ebf338 3	shared.txt

Auto-merging shared.txt
CONFLICT (content): Merge conflict in shared.txt
merge-tree exit=1
```

Script result — conflict detected and per-file detail extracted, exit 1:

```
$ bash .../git-safety-checks.sh merge-dry-run side-a side-b
CONFLICTS: merging side-b into side-a would conflict in:
  - shared.txt
exit=1
```

Also exercised the two other conflict shapes in the same scratch repo:

```
$ bash .../git-safety-checks.sh merge-dry-run side-d side-e     # add/add
CONFLICTS: merging side-e into side-d would conflict in:
  - conflict-add.txt
exit=1

$ bash .../git-safety-checks.sh merge-dry-run side-g side-f     # modify/delete
CONFLICTS: merging side-f into side-g would conflict in:
  - shared.txt
exit=1
```

### 4. `merge-dry-run` — clean pairs (scratch repo)

Non-conflicting pair (`side-c` adds a new file, touches nothing `side-a` changed) and a pure
fast-forward pair (`base` ← `side-a`):

```
$ bash .../git-safety-checks.sh merge-dry-run side-a side-c
clean: merging side-c into side-a would succeed with no conflicts
exit=0

$ bash .../git-safety-checks.sh merge-dry-run base side-a
clean: merging side-a into base would succeed with no conflicts
exit=0
```

### 5. No-side-effects guarantee

After every dry-run in the scratch repo, `git status --porcelain` was empty (working tree untouched)
and `git branch` showed no new refs/merge commits — confirming `merge-dry-run` is a true oracle that
writes nothing.

### 6. `pre-push-gate` + hook (real worktree)

Pass path (default `main` / `origin/main`; note the gate fetches first — the count jumped from 42 to
69 once `origin/main` was refreshed):

```
$ bash scripts/git-safety-checks.sh pre-push-gate
pre-push gate: fetching origin...
pre-push gate: checking that origin/main is an ancestor of main
safe to push: main is ahead of origin/main by 69 commits, fast-forward
exit=0
```

Fail path (forced via `GATE_BRANCH`/`GATE_REF` overrides to a NOT-SAFE pair), propagated through the
committed hook file:

```
$ GATE_BRANCH=feature/git-workflow-infra-a GATE_REF=feature/git-workflow-infra-b bash .githooks/pre-push
pre-push gate: fetching origin...
pre-push gate: checking that feature/git-workflow-infra-b is an ancestor of feature/git-workflow-infra-a
NOT SAFE: ... (as above)
hook exit=1
```

`npm run git:safety-check` runs the script (no args ⇒ usage, exit 1), confirming the package.json
entry.

### 7. Hygiene

- `bash -n` passes for both `scripts/git-safety-checks.sh` and `.githooks/pre-push`.
- No machine-specific absolute paths: the script and hook use `git rev-parse` (script validates it is
  inside a repo; hook resolves the script path via `git rev-parse --show-toplevel`), so both work from
  any clone.
- Scripts are committed executable (`chmod +x`).

## Notes for the merge/coordinator

- The hook deliberately runs a fetch-then-check (Q2 policy: `origin/main` is the source of truth), and
  only *blocks on divergence*; a plain `git push` already refuses non-fast-forward updates on `main`,
  so after the gate passes the push is fast-forward by construction.
- `pre-push-gate` defaults to `main`/`origin/main`; the `GATE_BRANCH`/`GATE_REF` overrides let the same
  gate be reused for task branches without editing the script.
- Part B's branch owns the protocol docs and report-path conventions; this branch owns only the files
  listed above plus the single package.json entry. No overlap.