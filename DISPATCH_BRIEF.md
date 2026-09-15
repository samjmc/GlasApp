# Phase 4A — Route Security Hardening

**Worktree:** `/private/tmp/glasapp-worktrees/phase-4a-route-security`  
**Branch:** `feature/phase-4a-route-security` (cut from `main`)  
**Task Slug:** `phase-4a-route-security`  
**Status:** Research + Implementation required

## Context

GlasApp has admin/privileged endpoints that require robust authentication and authorization. This phase audits the route handlers, identifies security gaps (missing auth checks, insufficient permission validation, incomplete RBAC), and hardens them.

## Task: Route Security Audit & Hardening

### 1. Security Audit (research phase)
- **Identify all admin/privileged routes** in `server/routes/`:
  - Admin-only endpoints (e.g., `/parliamentary/scores/recalculate`, `/admin/*`)
  - Privileged data access (user profiles, scoring, cache manipulation)
  - Batch/bulk operations (imports, exports, recalculations)
- **Check current auth pattern:**
  - How are admin routes protected today? (middleware? guards? missing?)
  - What's the auth context? (session? JWT? Supabase auth?)
  - Are permissions checked per-route or at middleware level?
- **Identify gaps:**
  - Routes with missing/incomplete auth checks
  - Routes that should restrict to specific roles (admin, moderator, user)
  - Routes that accept user input without validation
  - Routes with sensitive side effects (cache clear, data recalculation)

### 2. Implementation: Harden Found Gaps
- **For each vulnerable route:**
  - Add/enforce auth middleware guard (refuse unauthenticated requests)
  - Add role-based access control (RBAC) check (only admin/privileged can call)
  - Add input validation (zod schema, max payload size)
  - Log sensitive operations (who called, when, what changed)
- **Middleware consolidation:**
  - Consider centralizing admin guard into a reusable middleware if not already done
  - Ensure all admin routes use it consistently
- **Testing:**
  - Verify authenticated + authorized user can call endpoint
  - Verify unauthenticated request is rejected (403 or 401)
  - Verify wrong role is rejected (403)
  - Verify malformed input is rejected (400)

### 3. Verification
- **No new TypeScript errors:** `npm run check` must pass (baseline 2644 errors)
- **No regressions:** Legitimate calls still work
- **Coverage:** Document all admin routes audited and their hardening

## Files in Scope
- `server/routes/*.ts` — all route files (read, audit, modify)
- `server/middleware/*.ts` — auth/auth-guard middleware (read, may enhance)
- `server/types/` — auth context types (read, may extend for RBAC)
- `docs/agent-reports/phase-4a-route-security/` — REPORT.md, audit findings

## Do Not
- Modify database schema (that's Phase 4B RLS)
- Change TypeScript compiler settings (that's Phase 4C)
- Refactor non-security code (stay focused)

## Acceptance Criteria
- ✅ All admin/privileged routes audited (list in report)
- ✅ Identified gaps documented (specific route + vulnerability)
- ✅ Gaps hardened (auth/RBAC/validation added)
- ✅ Test plan executed (unauthenticated/wrong-role/malformed all rejected)
- ✅ `npm run check` passes (no new TS errors)
- ✅ REPORT.md written: audit findings, hardening changes, test results

## Report Location
- **Path:** `docs/agent-reports/phase-4a-route-security/REPORT.md`
- **Contents:** Routes audited, gaps found, fixes applied, test results

---

**Do this now. Audit, harden, test, report. No approval needed.**
