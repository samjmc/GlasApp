### Task 3 — Ideas submission: server-side admin enforcement

**File**: `server/routes/ideasRoutes.ts`

**Background**: `POST /ideas/submit` currently trusts the client-supplied `isAdminSubmission` boolean — any authenticated user can set it `true` and create admin-only ideas. It also reads `req.session.user?.id`, which is never populated (session stores `userId`, not `user`) — so the endpoint is broken for legit admins too.

**Changes**:
- Replace the client-trusted gate with server-side enforcement: protect the route with `requireAdminAccess` imported from `../middleware/adminAccess` (admin JWT, admin email allowlist, or job secret).
- Derive the author userId robustly: `req.user?.id ?? req.session?.userId ?? null`. If null after the guard, respond 401 `{ success:false, message:'Authentication required' }`.
- Delete the `isAdminSubmission` trust: ignore that field entirely (still accept it in destructuring or drop it — but do NOT branch on it).
- Keep the existing field validation (title, description, category required → 400), the user lookup, and the insert logic.
- After insert, log with `requestLogger(req)` pattern: `log.info({ operation: 'admin.ideas.submit', actor: req.user?.email ?? req.session?.userId, title }, 'Idea submitted')`. Do NOT rely on new Task 1 exports.
- Remove now-dead code (`const userId = (req.session as unknown)?.user?.id;`).

**Do NOT**: change the `/ideas/:category` GET, `/ideas/vote`, or `/ideas/categories/stats` handlers.

**Gates**:
- tsc total ≤ 2644; per-file count: ideasRoutes.ts ≤ 12.
- Code review confirms no client-controlled role/flag is trusted.

---

