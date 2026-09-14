# Security Audit Summary: Replit Auth Bypass Vulnerability

**Date:** 2026-09-10
**Status:** AUDIT COMPLETE - Ready for Implementation
**Severity:** CRITICAL (5/5)

---

## Vulnerability Confirmed

### Location: `server/replitAuth.ts:182-196`

```typescript
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // In local development (non-Replit), allow all requests for testing
  if (!isReplitEnvironment) {
    console.log("🔓 Local dev mode - bypassing authentication");
    // Mock user for development
    req.user = {
      claims: {
        sub: "dev-user-123",  // <-- VULNERABILITY HERE
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }
  // ... rest of auth logic
}
```

### Vulnerability Chain

1. **Trigger:** `REPLIT_DOMAINS` environment variable is unset (not in Replit)
2. **Condition:** `!isReplitEnvironment` evaluates to true (line 184)
3. **Result:** ANY request without authentication is granted `dev-user-123` identity
4. **Impact:** User can:
   - Access private routes (`/api/quiz/save`, `/api/vote/delete`, etc.)
   - Trigger paid LLM operations
   - Delete other users' votes
   - Save quizzes under fake identity
   - Access admin endpoints

### Root Cause

The logic conflates "local development" with "non-Replit environment":
- **Intention:** Developers should be able to test locally without Replit setup
- **Bug:** Implementation grants access to ANYONE in non-Replit environment
- **Context:** REPLIT_DOMAINS is unset both in:
  - Local development (expected)
  - Production when not using Replit hosting (vulnerability!)

---

## Codebase Analysis

### Existing Infrastructure Assessment

#### 1. **Supabase Auth System (Already Implemented) ✓**

**File:** `server/auth/supabaseAuth.ts`
- Bearer token extraction: Lines 53-76 (getUserFromRequest)
- JWT verification with Supabase: Correct implementation
- Middleware exports: isAuthenticated, isAdmin, optionalAuth

**Status:** READY to use. No changes needed.

```typescript
export async function getUserFromRequest(req: Request): Promise<any | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null; // Correctly returns null for missing bearer
  }
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user; // JWT verification happens here
}
```

#### 2. **Session Middleware (Partially Vulnerable)**

**File:** `server/middleware/sessionMiddleware.ts`
- Session-based auth check: Line 31 (req.session.userId)
- Bearer token check: MISSING (needs to be added)

**Status:** Needs fallback for bearer tokens when sessions not available.

#### 3. **Query Client (No Bearer Attachment)**

**File:** `client/src/lib/queryClient.ts`
- Request headers: Line 22-23 (only Content-Type set)
- Authorization header: MISSING
- Bearer token from storage: MISSING

**Status:** Client-side bearer attachment not implemented. Needed for production auth flow.

#### 4. **Database Configuration (Service-Role Bypass)**

**File:** `server/db.ts`
- supabaseDb initialized with SERVICE_ROLE_KEY: Line 35-54
- RLS bypass: ACTIVE (intentional for admin ops)
- Documentation: MISSING (needs warning about RLS bypass)

**Status:** Correct setup, but undocumented. Needs JSDoc warning.

#### 5. **Routes Configuration**

**File:** `server/routes.ts`
- Import from supabaseAuth.ts: Line 10 ✓
- Auth middleware usage: Correct in most routes

**Status:** Correct usage. No changes needed for auth logic.

---

## File Modification Map (7 Files to Change)

### Required Changes Summary

| File | Change Type | Priority | Risk | Lines |
|------|------------|----------|------|-------|
| `server/replitAuth.ts` | Remove bypass, add bearer validation | CRITICAL | HIGH | 183-196 → 40 new lines |
| `server/middleware/sessionMiddleware.ts` | Add bearer fallback | HIGH | MEDIUM | +8 lines |
| `client/src/lib/queryClient.ts` | Add bearer attachment | HIGH | MEDIUM | +15 lines |
| `server/auth/supabaseAuth.ts` | Add JSDoc | LOW | NONE | +20 lines |
| `server/db.ts` | Add RLS warning | LOW | NONE | +10 lines |
| `server/routes.ts` | Verify (no changes) | NONE | NONE | Audit only |
| `test/integration/auth-bypass-prevention.test.ts` | Create new | CRITICAL | NONE | 200+ lines |

**Total:** 7 files, ~110 lines of changes (net: +90 lines after removals)

---

## Implementation Boundaries (Enforced by Gate)

### SCOPE DECLARATION

**This implementation will touch ONLY these 7 files. No other modifications allowed.**

Files EXCLUDED from this PR:
- `server/routes/` - individual route handlers (use existing auth middleware)
- `client/src/components/` - UI code (bearer attachment is layer below)
- `server/db.ts` - schema changes (only JSDoc)
- `package.json` - no new dependencies
- `.env.example` - no env var changes

**Gate Verification:** Post-commit, gate will verify:
1. Exactly 7 files modified (no extras)
2. No modified files outside this scope

---

## Failing Test Created

**File:** `test/integration/auth-bypass-prevention.test.ts`

### Test Coverage

#### Suite 1: Unauthenticated Handling
- Test 1: GET without bearer → 401 (NOT 200 with dev-user-123)
- Test 2: POST without bearer → 401
- Test 3: Admin endpoint without bearer → 401

#### Suite 2: Bearer Validation
- Test 4: Valid bearer → 200
- Test 5: Invalid bearer → 401
- Test 6: Tampered token → 401

#### Suite 3: Dev Mode Gating
- Test 7: NODE_ENV=development allows dev-user-123
- Test 8: NODE_ENV=production rejects dev-user-123

#### Suite 4: Code Inspection
- Test 9: grep finds dev-user-123 only in safe locations

#### Suite 5: Comprehensive Coverage
- Tests 10+: All HTTP methods require auth

**Total:** 15+ test cases

---

## Architecture Decision: Bearer Token Flow

### Current State (BROKEN)
```
Unauthenticated User → GET /api/quiz/save → No bearer → isAuthenticated() {
  if (!isReplitEnvironment) {
    req.user = {sub: "dev-user-123"} → ALLOW ACCESS ❌
  }
}
```

### Fixed State (SECURE)
```
1. User Signup
   User → Supabase auth API → Get JWT token → Store in localStorage
   
2. Authenticated Request
   Client → queryClient.ts {bearer attachment} → GET /api/quiz/save {Authorization: Bearer <token>}
   
3. Server Validation
   GET /api/quiz/save → isAuthenticated() middleware → getUserFromRequest(req) {
     Extract Bearer from Authorization header
     Verify with Supabase (JWT validation)
     If valid → req.user = {sub: "user-uuid"} → ALLOW
     If invalid → 401 Unauthorized
   }
   
4. Unauthenticated Request (Explicitly Rejected)
   User (no login) → GET /api/quiz/save (no bearer) → isAuthenticated() → 401 ❌
```

---

## Security Properties After Fix

### Property 1: No Dev Bypass in Production
- **Before:** Any request in non-Replit environment gets dev-user-123
- **After:** Only requests in NODE_ENV=development get dev-user-123
- **Production Behavior:** All requests require valid Supabase bearer token

### Property 2: Bearer Token Verification
- **Implementation:** JWT signature verification with Supabase
- **Tampering:** Impossible (signature mismatch → 401)
- **Expiration:** Handled by Supabase (expired tokens fail verification)

### Property 3: No Implicit Trust
- **Before:** Absence of authentication was treated as developer
- **After:** Absence of authentication is treated as unauthorized
- **Trust:** Only established with valid signed token

### Property 4: Clear Request Context
- **Before:** req.user could be fake (dev-user-123)
- **After:** req.user is either:
  - Verified from Supabase token
  - Undefined (unauthenticated)
  - From session (Replit auth only)

---

## Risk Assessment

### Implementation Risk: LOW
- **Reason:** Supabase auth system already exists and working
- **Changes:** Gating existing middleware, adding bearer attachment
- **Rollback:** Simple (revert 4 commits)

### Testing Risk: LOW
- **Reason:** Tests are isolated, use mocks
- **Changes:** New test file only
- **Coverage:** All critical paths tested

### Production Risk: MEDIUM
- **Reason:** Breaks unauthenticated access (intentional)
- **Mitigation:** Must deploy with client bearer attachment
- **Deployment:** Must be atomic (server + client together)

### Gates to Pass: 12 checks
1. Scope verification (7 files)
2. Method signature completeness
3. Call site audit
4. TypeScript compilation
5. No dev-user-123 in production
6. Test coverage >= 80%
7. Integration tests pass
8. No regressions
9. JSDoc completeness
10. Migration safety
11. Documentation
12. Performance (no regressions)

---

## Known Hotspots & Conflicts

### Hotspot 1: queryClient.ts Conflict
**Issue:** Candidate 10 also modifies `client/src/lib/queryClient.ts`
**Resolution:** Document which changes are for bearer attachment vs. other optimizations
**Commit Note:** Include conflict resolution in commit message

**Example:**
```
feat: attach Supabase bearer token to all client requests

- Add bearer extraction from localStorage
- Include Authorization header on all requests
- Note: Candidate 10 also modifies this file (keep both changes)
  - This PR: Bearer token attachment
  - Candidate 10: Query client optimizations
```

### Hotspot 2: isAuthenticated Export Conflict
**Issue:** Two exports of isAuthenticated:
- `server/replitAuth.ts` (being fixed)
- `server/middleware/sessionMiddleware.ts` (existing)
- `server/auth/supabaseAuth.ts` (production auth)

**Resolution:** Routes import from `server/auth/supabaseAuth.ts` (already correct at line 10 of routes.ts)
- Verify no imports from replitAuth.ts
- Verify no imports from sessionMiddleware.ts isAuthenticated

### Hotspot 3: Service-Role Client Usage
**Issue:** supabaseDb in db.ts uses SERVICE_ROLE_KEY (bypasses RLS)
**Documentation:** Add JSDoc warning
**Audit:** Check no service-role client used for user requests
- User requests must use bearer token (client-side)
- Admin/batch ops can use service-role (server-side only)

---

## Deployment Checklist

Before shipping to production:
- [ ] All 7 files modified correctly
- [ ] No dev-user-123 in production code paths
- [ ] Bearer attachment working on client
- [ ] Server validates bearer tokens
- [ ] Tests pass (npm test)
- [ ] TypeScript compiles (npm run check)
- [ ] No new dependencies added
- [ ] Commit messages are clear
- [ ] Gate passes all 12 checks
- [ ] Staging environment test pass
- [ ] Production deployment ready

---

## Summary: Ready for Implementation

### Audit Findings
✓ Vulnerability confirmed and isolated
✓ Fix design validated
✓ Implementation plan documented
✓ 7-file scope declared and enforced
✓ Supabase auth system verified as working
✓ Tests created and ready to fail
✓ No new dependencies required

### Next Steps
1. **Phase 1:** Implement middleware changes (replitAuth.ts, sessionMiddleware.ts)
2. **Phase 2:** Implement client bearer attachment (queryClient.ts)
3. **Phase 3:** Add documentation (auth, db)
4. **Phase 4:** Run tests and verify gate
5. **Phase 5:** Deploy to staging, then production

### Handoff Status
✓ Ready to implement
✓ Implementation plan complete
✓ Failing test ready
✓ Implementation boundaries enforced
✓ Gate verification checklist provided

**Implementation can begin immediately.**

