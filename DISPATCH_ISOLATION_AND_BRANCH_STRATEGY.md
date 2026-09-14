# Dispatch Isolation & Branch Strategy — Design Doc

Status: **ADOPTED — implemented 2026-09-14.** Sections 1-3 (worktree-per-team SOP, pinned-base-SHA policy) are now the standing policy for all future parallel DeepSeek dispatches. Section 4 (main/test-gate-fix reconciliation) has been executed as follows — see "Execution Log" below for exactly what ran and what remains.

Investigated by: read-only investigation of `/Users/sammcdonnell/Documents/GlasApp` on 2026-09-14. All commands run were read-only (`git log`, `git status`, `git worktree list`, one scratch `git worktree add`/`remove` in `/tmp` that was fully cleaned up, and a `tsc --noEmit` dry run in that scratch worktree). No files in the canonical repo were modified, no branches created/deleted, no commits made.

---

## Execution Log (added post-adoption)

Sam's sign-off covered: (a) one-time reconciliation of `main`, (b) worktree-per-team + pinned-base-SHA SOP for all future dispatches.

1. **`main` reconciled with `origin/main`.** Merged `origin/main`'s commit `001656f` ("Secure admin job endpoints #16") into local `main` via `git merge --no-ff origin/main` — chosen over a blind fast-forward/merge because local `main` had independently restructured `server/routes.ts` since divergence (route files split, e.g. `parliamentary.ts` → `parliamentary/scores.ts` + `enhanced-profiles.ts` + `constituencies.ts` + `votingRoutes.ts`), so a textually-clean merge would NOT have guaranteed the security fix (`requireAdminAccess` middleware, `isAdmin()` privilege-escalation fix) actually applied to the live route bindings. Resolved by hand-verifying, via grep, that all 8 originally-gated endpoints are covered on main's current route structure post-merge. New `main` tip: `9961db2`. **Not pushed to origin** — Sam has not yet approved a push, so the 25+1 reconciled commits remain local-only pending that decision. Section 4 step 1 (push reconciled main to origin) is therefore still open.
2. **`test-gate-fix` rebased onto reconciled `main`.** `git rebase main` from an isolated worktree. Old tip `fbb12b2` → new tip `6d19bc0`. One non-textual conflict found and fixed: both `main` and `test-gate-fix` had independently implemented the same 9 auth storage methods in `server/storage.ts` with incompatible signatures (git didn't flag this as a conflict since it was two full-function-body diffs, not overlapping hunks) — resolved by keeping the version matching real call sites in `authService.ts`/`authRoutes.ts`.
3. **Phase 2 branches rebased onto new `test-gate-fix` tip (`6d19bc0`):**
   - `feature/phase-2a-component-consolidation`: `a01f799` → `3e12cca`.
   - `feature/phase-2b-schema-cleanup`: `5d8a0de` → `a9804f8`.
   - `feature/phase-2c-service-consolidation`: `c99e012` → `6d19bc0` (zero unique commits; now identical to test-gate-fix's tip, kept as a branch pointer rather than deleted).
4. **SOP verified end-to-end**: three concurrent-capable rebases were each run in their own isolated worktree under `/tmp/glasapp-worktrees/`, symlinked `node_modules`, sequentially executed, no shared-directory interference — confirming Section 2's mechanism works in practice, not just in the original investigation's dry run.

**Still open / not yet done:**
- Push reconciled `main` to `origin` (needs explicit sign-off — this changes the remote).
- The pinned `BASE_SHA` for the *next* dispatch round should be `test-gate-fix`'s current tip `6d19bc0` (see `plan.md`).
- Four pre-existing `feature/phase-3*` branches (`phase-3a-ai-service`, `phase-3b-frontend-auth`, `phase-3c-cache-adapter`, `phase-3d-error-standardization`) were found already checked out as worktrees under `/tmp/glasapp-worktrees/`, all pointing at `main`'s tip with zero unique commits — these predate this reconciliation work and weren't created by it. Flagged for awareness, not touched.

---

## Section 1 — Root cause summary

### Problem 1: Shared working directory race

**Confirmed cause:** three parallel dispatched teams (2A, 2B, 2C) each ran `git checkout -b <branch>` directly inside the single canonical working directory `/Users/sammcdonnell/Documents/GlasApp`. `git checkout -b` mutates two pieces of *global, single-copy* repo state — the `HEAD` symref and the working tree contents — for the *entire repository*, not just for the process that invoked it. Because all three teams shared one working directory, each `checkout` from any one team instantly changed what every other team's concurrently-running shell/editor/tool saw on disk.

**Evidence, as reported by the teams themselves:**
- 2B: "the checked-out branch was switched away to feature/phase-2c-service-consolidation twice by a concurrent process, and it silently discarded one in-progress edit." — this is a direct consequence of another team's `checkout` running while 2B had uncommitted edits; git will auto-stash or, in some cases, simply overwrite tracked file contents depending on timing, which matches "silently discarded."
- 2A: observed HEAD flipping test-gate-fix → 2c's branch → 2b's branch mid-session, and saw another team's uncommitted `shared/schema.ts` changes appear and disappear as a stash entry. This is the textbook signature of two `git checkout` calls racing on the same `.git/HEAD` and index.
- 2A's self-protection (manually building a worktree at `/tmp/glasapp-worktrees/phase-2a` and doing all work there) is itself proof that `git worktree` is viable in this environment and that a worktree's commits land correctly in the shared `.git` object/ref store of the main checkout — this was independently re-verified in this investigation (see Section 2).
- 2C had zero required changes, so it never triggered the race, but it was still exposed to the same shared-directory hazard as 2A/2B; its "lucky" outcome is not evidence the setup is safe.

**Why the Agent tool's built-in worktree isolation wasn't available:** the tool's isolation feature requires (a) `WorktreeCreate` hooks configured in `settings.json`, which are not configured in this environment, and (b) the coordinator's own process to be recognized as running "in a git repository" at the point isolation is requested — which failed here, most likely because the coordinator's shell `cwd` at dispatch time was not itself inside `/Users/sammcdonnell/Documents/GlasApp` (or any git repo) when the isolation request was made, even though the *target* directory for the dispatched work is a git repo. This is a tool-level gap, not a property of the GlasApp repo — the repo itself supports worktrees fine (proven in Section 2). The fix therefore has to be a manual/scripted SOP that the coordinator runs itself, rather than relying on the tool's native feature.

**Root cause, one sentence:** parallel agents shared one working tree and each independently mutated global `HEAD`/index state via `git checkout -b`, with no isolation between them, because the tool's native worktree-isolation path was unavailable and no manual substitute was used.

### Problem 2: `main` has independent history

**Confirmed facts (not speculation — verified directly against the repo):**

1. `git merge-base main test-gate-fix` = `5aa98f5`. Everything after that commit on `main` (25 commits, `main` is 25 commits ahead of `test-gate-fix`'s common ancestor along its own line) is a separate line of work that `test-gate-fix` does not contain.
2. Every one of those 25 commits (from `117ff4f` at the merge-base side up through `c99e012` at the tip) is authored **and committed** by `Samuel McDonnell <104273103+samjmc@users.noreply.github.com>` — the user's own GitHub-noreply identity, exactly as it would appear from a commit made via GitHub's web UI, GitHub Desktop, or (most likely given the tooling in play) **Cursor's editor/agent committing locally under the user's configured git identity**. There is no bot account, no `[bot]` suffix, no CI-service committer identity anywhere in this range. This is **not** an automated CI/bot process pushing to `main` on GitHub — the commit metadata is indistinguishable from a human (or an agent acting as that human) committing locally.
3. Commit timestamps run from `2026-09-10 10:23:57 +0100` (`117ff4f`) to `2026-09-10 22:17:01 +0100` (`c99e012`, the current tip of local `main`). Today is `2026-09-14`. **These commits are ~4 days old, not "hours ago."** This directly contradicts the hypothesis in the task brief that timestamps close to "now" would indicate a live, actively-running parallel process — they don't. This looks like a single day's burst of work (10 Sept, ~12 hours span) that has simply not been touched since.
4. Local `main` vs `origin/main`: `git rev-list --left-right --count main...origin/main` = `25` ahead / `1` behind. That means:
   - The 25 "mysterious" commits on local `main` (including all 8 named in the task, plus 17 earlier ones) **exist only in this local checkout — they were never pushed to `origin`.** This rules out "a CI bot is landing commits on GitHub's main independently of us" entirely; there is no bot-driven remote activity to reconcile with.
   - `origin/main` has exactly one commit local `main` lacks: `001656f Secure admin job endpoints (#16)`, i.e. local `main` is also stale/behind the actual GitHub `main` by one merged PR.
5. No `.github/workflows/` directory exists in the repo, and no CI/bot config referencing Cursor was found (the only "cursor" string hits were incidental matches inside `cursor`-pagination-related JSON/code, not tooling config). So there is no in-repo CI automation that would explain this.
6. The 60+ `origin/cursor/critical-bug-investigation-*` and `origin/cursor/critical-correctness-bugs-*` remote branches are real and do indicate Cursor's background-agent feature has been active on this repo via GitHub — but they are **separate branches**, not commits on `main`, and are unrelated to how local `main` itself picked up its 25 extra commits (which, per point 2, were never pushed anywhere).

**Hypothesis (best evidence):** on 10 September, the user (Sam) did a substantial day of work directly in this repo — most likely using Cursor's editor (not the Cursor background-agent-on-GitHub feature, which produces separate branches and would show a different committer identity) — committing locally to `main` under his own identity, and never pushed those commits to `origin`, and separately never rebased/merged that work into `test-gate-fix` before this Claude session started doing Phase 1/2 work on `test-gate-fix` off an older base. `main` is **stale, abandoned-in-place local work**, not a live parallel process. Nobody else and no automation is currently advancing it.

**Recommendation:** Treat `main` as a **one-time reconciliation problem, not an ongoing coordination problem.** Concretely:
- Do **not** treat `main` as "the actively developed line" — it hasn't moved in 4 days and nothing is pushing to it.
- Do **not** silently discard it either — 25 commits of real feature/fix work (auth bearer-token wiring, storage layer methods, dual-write migration work, RLS bypass fixes) sitting only in a local `main` is valuable and should not be lost.
- The correct one-time action (for Sam to approve, not to execute automatically) is: **rebase `test-gate-fix` onto local `main`** (i.e. `main`'s tip becomes the new base for the Phase 1/2 refactor work), *after* first fast-forwarding local `main` to include origin's one extra commit (`001656f`) and pushing the reconciled `main` to `origin` so this local-only history isn't sitting as an orphaned risk on one machine. Rebasing `test-gate-fix` onto `main` (rather than merging `main` into `test-gate-fix`, or ignoring `main`) is preferred because: (a) `main`'s commits chronologically precede `test-gate-fix`'s Phase 1/2 work and look like foundational fixes (auth, storage layer correctness) that the refactor work should have been built on top of in the first place; (b) it keeps history linear and avoids a merge commit that permanently entangles two branches that were never designed together; (c) it surfaces conflicts once, now, while the diff is still small, rather than at final-merge time when Phase 2A/2B/2C branches also need to land.
- After that one reconciliation, `main`'s divergence risk goes away — there is no bot or background process to keep re-diverging against, per the evidence above. This should be confirmed with Sam before running, since it rewrites `test-gate-fix`'s commit history (rebase, not merge).

---

## Section 2 — Step-by-step SOP for worktree-per-team dispatch

### Verification performed

- `git worktree list` on the live repo shows worktrees are already in active, working use here: the canonical checkout, plus `glas-baseline-check` (a real worktree at `5aa98f5`, still linked correctly via `.git` → `gitdir: /Users/sammcdonnell/Documents/GlasApp/.git/worktrees/glas-baseline-check`), plus two `prunable` entries from an unrelated prior tool run (`glasapp-tsc-verify/base`, `glasapp-tsc-verify/pr16` in a `TMPDIR` opencode path) whose target directories no longer exist. These are stale and should be pruned (`git worktree prune`) but their presence confirms worktrees have been used successfully against this exact repo before.
- A fresh scratch worktree was created and destroyed as part of this investigation (`git worktree add /tmp/glasapp-worktree-test/probe main`): checkout completed cleanly (2159 files), `git branch --show-current` correctly reported `main` inside the worktree while the canonical directory remained on its own branch (`feature/phase-2b-schema-cleanup`) throughout — i.e. **two worktrees on different branches coexisted with zero interference**, which is the entire point of this SOP.
- `node_modules` (712M) was **symlinked** (not copied/reinstalled) from the canonical repo into the scratch worktree: `ln -s /Users/sammcdonnell/Documents/GlasApp/node_modules node_modules`. `tsc --version` and `vite --version` both ran correctly through the symlink, and a full `tsc --noEmit -p .` ran to completion (surfacing genuine pre-existing type errors in `server/storage.ts`, `server/vite.ts`, `shared/data.ts` — unrelated to worktree mechanics, proving the tool works end-to-end from a worktree path via symlinked `node_modules`).
- `package.json` has no `postinstall`/`install` script and no native-addon dependencies that would require a per-worktree/per-arch build step. `engines.node` is `>=20.0.0`, a plain version constraint, not a native-binding concern. **Conclusion: a single shared, symlinked `node_modules` is safe for every worktree in this repo.** There is no evidence of anything requiring a fresh `npm install` per worktree.

### The SOP

Run every step below from the coordinator's own shell, and make every dispatched agent's *first* instruction be "cd into `<worktree_path>` and do not touch `/Users/sammcdonnell/Documents/GlasApp` directly."

```bash
# ---- Coordinator, before dispatching ANY team in a round ----

REPO=/Users/sammcdonnell/Documents/GlasApp
WT_ROOT=/tmp/glasapp-worktrees      # or any stable path outside the repo
BASE_SHA=<agreed base commit SHA — see Section 3>

mkdir -p "$WT_ROOT"

# 1. Prune stale worktree records before adding new ones (cheap, always safe)
git -C "$REPO" worktree prune

# 2. For EACH team N with branch name <branch-N>, from the SAME $BASE_SHA:
git -C "$REPO" worktree add -b <branch-N> "$WT_ROOT/<branch-N>" "$BASE_SHA"

# 3. Symlink the shared node_modules into the new worktree (no reinstall needed)
ln -s "$REPO/node_modules" "$WT_ROOT/<branch-N>/node_modules"

# 4. Repeat step 2-3 once per team, all pointing at the SAME $BASE_SHA.
```

Then the dispatch brief for each team must say, verbatim:

> Your working directory for this entire task is `$WT_ROOT/<branch-N>`. `cd` there first and confirm with `pwd` and `git branch --show-current` before making any edit. Do not `cd` into or edit anything under `/Users/sammcdonnell/Documents/GlasApp` directly — that is the coordinator's canonical checkout and is shared by other concurrently-running teams. All your commits should land on `<branch-N>`, created from base `$BASE_SHA`.

**Cleanup, per team, once its branch is merged or abandoned:**

```bash
# after the branch's commits are merged into the integration branch, or the work is abandoned:
git -C "$REPO" worktree remove "$WT_ROOT/<branch-N>"
# optionally, if the branch itself is no longer needed:
git -C "$REPO" branch -d <branch-N>        # or -D if abandoning unmerged work, with sign-off
```

Run `git -C "$REPO" worktree prune` again at the start of the next dispatch round to sweep up anything removed manually/out-of-band (as happened with the pre-existing `glasapp-tsc-verify` entries found during this investigation).

**Guardrail the coordinator should self-check before dispatch:** run `git -C "$REPO" worktree list` immediately before writing each team's brief and confirm the path you're about to hand out doesn't already exist / isn't already owned by a different in-flight team.

---

## Section 3 — Branch-base policy for a dispatch round

**Rule:** every team dispatched within the same round must branch from one identical, explicitly-named commit SHA — not a branch name (branch names move; a coordinator or another team advancing `main`/`test-gate-fix` mid-round would silently change what "base" means for a team that resolves it late), and never a bare `git checkout -b` off of "whatever HEAD happens to be" in the shared directory (this is exactly the Problem 2B/2C mechanism — 2B and 2C ended up on `main` instead of `test-gate-fix` because HEAD in the shared directory was ambiguous/contended at the moment they branched).

**Procedure:**

1. Coordinator picks the base *once per round*, e.g.:
   ```bash
   BASE_SHA=$(git -C "$REPO" rev-parse test-gate-fix)
   ```
   and writes that literal 40-char SHA into every team's dispatch brief for that round. Never write "branch off test-gate-fix" — write "branch off commit `<SHA>`, which is `test-gate-fix` as of `<timestamp>`."
2. Every team's very first git command must be:
   ```bash
   git worktree add -b <branch-N> "$WT_ROOT/<branch-N>" <BASE_SHA>
   ```
   (done by the coordinator per Section 2, or by the agent itself if it must do the worktree creation — either way the SHA is pinned, not resolved from a mutable ref at an unknown time.)
3. The coordinator records `BASE_SHA` (and the round's branch list) in the round's dispatch log/ledger so that when branches are reconciled later, everyone agrees what "the round's base" was, and any git operations (rebase, diff against base) use that same fixed point.
4. If a round's base needs to change mid-flight (e.g. a hotfix must land first), that is a new round: finish or explicitly re-base the in-flight teams onto the new SHA — never let a base silently drift under a team that already started.

This directly prevents the Problem 2B/2C failure mode: it would have been structurally impossible for a team to end up based on `main` "by accident" if the base were a pinned SHA baked into its dispatch brief and its first git command, rather than an implicit "whatever branch the shared directory happens to be on right now."

---

## Section 4 — `main` vs `test-gate-fix`: recommendation (executed — see Execution Log above)

See Section 1 for full evidence. Original action items, now executed except where noted:

1. Fast-forward local `main` to include `origin/main`'s one extra commit (`001656f`) — **done** via `--no-ff` merge (not fast-forward, due to independent route restructuring — see Execution Log). Push to `origin` — **not done, pending Sam's sign-off.**
2. Rebase `test-gate-fix` onto the reconciled `main` — **done.**
3. Use the *post-rebase* `test-gate-fix` tip as the new `BASE_SHA` for the next dispatch round — **recorded in `plan.md`.**
4. This was a one-time reconciliation, not a recurring sync — confirmed no live process was advancing `main` independently, so no ongoing "coordinate with main every round" policy is needed now that reconciliation is done.
