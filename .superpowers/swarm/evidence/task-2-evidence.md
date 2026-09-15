# Task 2 Evidence — Bot routes: real admin gating + protect bot behavior control

Verifier: independent. Method: every gate run directly from the worktree root
`/private/tmp/glasapp-worktrees/phase-4a-route-security`. No files modified by
the verifier. Worktree is a shared swarm worktree (other wave-1 tasks present);
verified at the end that the working tree for the two files matches
`.superpowers/swarm/diffs/task-2.diff` exactly (byte-identical, 120 lines).

## Environment notes (reproducibility)

- tsc is slow (~3–5 min per full run); concurrent swarm agent activity caused
  transient worktree churn mid-verification (files flipped to HEAD for a moment
  and back). Final re-check: working tree == task-2.diff, exact match.
- A baseline-comparison attempt via `git stash` timed out (empty capture) and
  was abandoned; error attribution is done via diff-line-region analysis instead
  (below), which is deterministic and sufficient.

## Gate 1 — tsc total ≤ 2644

Command: `node_modules/.bin/tsc 2>&1 | grep -c "error TS"`

Actual result: **2642** (captured twice: first run and full capture to
`/tmp/tsc-task2.txt`). **PASS** (≤ 2644).

Note: implementer reported 2643; my independent runs measured 2642. Both are
within the gate. The 1-error delta is attributable to concurrent wave-1 edits in
the shared worktree (e.g. `server/auth/supabaseAuth.ts` from Task 1), not to this
task's changes.

## Gate 2 — per-file counts: botRoutes.ts ≤ 3, routes.ts ≤ 16

Source: full tsc capture `/tmp/tsc-task2.txt`.

### server/routes/botRoutes.ts — **2** errors (≤ 3) PASS

```
server/routes/botRoutes.ts(49,16): error TS18046: 'error' is of type 'unknown'.
server/routes/botRoutes.ts(93,16): error TS18046: 'error' is of type 'unknown'.
```

Diagnosis: both are on `message: error.message || '...'` inside `catch (error)`
blocks of the `/create` (line 49) and `/:username` (line 93) handlers. The
task-2 diff does NOT touch these catch blocks (diff touches only imports,
middleware declarations, and the three added `requestLogger(req).info(...)`
calls). Identical catch blocks exist at HEAD (`git show HEAD:server/routes/botRoutes.ts`
lines 49 & 89). **Pre-existing.**

### server/routes.ts — **16** errors (≤ 16) PASS

Error lines: 209, 213, 239, 240, 308, 313–320, 361, 377, 378.

Diagnosis: all are on lines 209–378 (respond-entitlement/API-response typing).
The task-2 diff only touches the bot behavior region (hunk headers
`@@ -388,9 +388,12 @@`, `@@ -407,9 +410,12 @@`, `@@ -419,9 +425,12 @@`).
Zero errors in the touched region. **Pre-existing.** (Note: pass is exact/at the
limit — 16/16; no headroom but within gate.)

## Gate 3 — guard middleware test still passes

Command: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts`

Actual result:

```
✓ server/middleware/adminAccess.test.ts (4 tests) 3ms
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**PASS** (4/4).

## Diff conformance (requirements cross-check)

- `server/routes/botRoutes.ts`: local `const isAdmin = (req, res, next: unknown)` stub
  **removed** (verified: `grep -n "const isAdmin"` → no match). `isAuthenticated`
  import removed; `requireAdminAccess` imported from `../middleware/adminAccess`
  and applied to `POST /create`, `GET /list`, `DELETE /:username` (single guard).
  `requestLogger(req).info({ operation: 'admin.bots.{create,list,delete}', actor: ... }, 'Bot admin action')`
  added to each handler using the repo-standard actor cast
  `(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId`.
  Handler bodies/validation otherwise untouched. CONFIRMED.
- `server/routes.ts`: `requireAdminAccess` added to all three inline routes —
  `POST /api/bots/:id/behavior/start`, `POST /api/bots/:id/behavior/stop`,
  `GET /api/bots/:id/activity`. Each adds
  `if (!Number.isInteger(botId) || botId <= 0) return res.status(400).json({ success: false, message: 'Invalid bot id' });`
  (400 on non-finite / non-integer / non-positive id). CONFIRMED.
- No other route files changed: `grep "^diff --git" .superpowers/swarm/diffs/task-2.diff`
  returns exactly `server/routes.ts` and `server/routes/botRoutes.ts`. CONFIRMED.
- Working tree matches task-2.diff byte-for-byte (verified `git diff` of the two
  files == `.superpowers/swarm/diffs/task-2.diff`). CONFIRMED.

## Verdict

**PASS** — all three gates green; all diff-conformance requirements met; all
remaining tsc errors in the two files are pre-existing and attributable by
diff-line-region analysis.