# Authentication

One mechanism: a Supabase access token in `Authorization: Bearer`. The client signs in with
Supabase (password, magic link or Google), the server verifies the token on each request and
puts the caller on `req.user`. There is no server-side session, no cookie identity and no
second user store.

Identity is always **`req.user.id`** — the Supabase `auth.users` UUID. Every `user_id` column
in the schema is a `varchar`, so that one value fits everywhere.

## The guards — `server/auth/`

| Guard | Passes when |
|---|---|
| `requireAuth` | the token verifies; else 401 |
| `optionalAuth` | always; attaches `req.user` when a token is present |
| `requireAdmin` | the caller's role is admin; else 401/403 |
| `requireJob` | the job secret is in `x-admin-secret`/`x-cron-secret`, or the caller is an admin |

Helpers: `ownsOrAdmin(req, res, targetUserId)` for any `/:userId/…` route, `currentUserId(req)`,
`logAdminAction(req, action, detail)`.

`optionalAuth` runs app-wide in `registerRoutes`, so a handler can offer a signed-in view
without its own guard and `regionMiddleware` can read the user's saved region.

**Admin comes from the server only.** `app_metadata.role === 'admin'` or the `ADMIN_EMAILS`
allowlist. `user_metadata` is editable by the user and is never consulted for authorisation —
the client does read it for UI, so client-side admin chrome is forgeable and the server does
not honour it.

**Machine callers do not use `Authorization`.** The job secret goes in `x-admin-secret` or
`x-cron-secret`. It used to be accepted in the bearer header too, which meant every admin
request compared a user's JWT against the shared secret. Cron jobs must send the dedicated
header.

## What this replaced (2026-09-22)

Three `isAuthenticated` implementations with three different identity shapes:

| Was | Gave you | Fate |
|---|---|---|
| `auth/supabaseAuth.ts` | Supabase user, `req.user.id` | became `server/auth/` |
| `middleware/sessionMiddleware.ts` | `req.session.userId`, an integer | deleted |
| `replitAuth.ts` | `req.user.claims.sub` | deleted |

Session auth was provably dead: the only endpoint that set `req.session.userId` was
`POST /api/auth/login`, which the client never called (sign-in has always been Supabase), and
the store was in-process memory. `replitAuth`'s `setupAuth` was never called, so Passport was
never initialised and its OIDC routes never existed; its guard resolved to the fabricated
`dev-user-123` in development and to `undefined` in production.

Also deleted: `services/authService.ts` (no importers), ten unmounted routers, the dead
`signUp`/`signIn`/`signOut`/… helpers, `requireRole` (used only by its own test), and
`authRoutes.ts` — a second account system whose registration wrote `users` rows with a freshly
generated UUID that could never match a Supabase identity.

## Consequences worth knowing

Several features were **broken before this and work now**, because they authorised on a
`req.session.user` that nothing ever set, or on Replit claims that resolved to nothing: idea
voting, problem and solution voting, party sentiment voting, political evolution, quiz history,
category rankings, activity logging, and the whole profile family.

Two real holes closed: `POST /api/user/rankings/personal/quiz` took a `userId` from the body
with no guard, so anyone could overwrite anyone's quiz results and rankings; and
`POST /api/auth/verify-phone-code` did the same to mark any account's phone verified.

`DELETE /api/account` (GDPR erasure) was imported but never mounted, so it returned 404 while
the client called it. It is mounted now.

## The profile — `/api/profile`

`users` is the application-side profile, keyed by the Supabase id and written only by
`server/routes/profileRoutes.ts`. The row is created on the first authenticated request, so
there is no registration step that can leave Supabase and the app out of step.

| Route | |
|---|---|
| `GET /me` · `PATCH /me` | read and update the profile |
| `POST /phone/verify` · `POST /phone/resend` | SMS verification of the caller's own number |
| `POST /image` | avatar upload |

## Tests

`server/auth/auth.test.ts` covers the four guards, including that `user_metadata` never grants
a role and that the job secret is not accepted through `Authorization`.

`server/auth/route-coverage.test.ts` pins the invariants by reading the route files: every
mutating route is guarded or on an allowlist that must give a reason; nothing reads a session,
Replit claims, a fabricated dev identity, or a user id from a request body. It found five real
leftovers the first time it ran.
