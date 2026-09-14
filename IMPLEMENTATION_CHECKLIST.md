# Implementation Checklist: Replit Auth Bypass Fix

**Start Date:** 2026-09-10
**Target Date:** 2026-09-12
**Status:** READY FOR IMPLEMENTATION

---

## Pre-Implementation Verification

### ✓ Audit Complete
- [x] Vulnerability confirmed
- [x] Files identified (7)
- [x] Implementation plan documented
- [x] Tests created and failing
- [x] No dependencies needed

### ✓ Team Readiness
- [x] Understand vulnerability (dev-user-123 bypass)
- [x] Understand fix (gate to NODE_ENV, add bearer validation)
- [x] Understand gate (12 checks, auto-runs at phase end)
- [x] Understand scope (7 files only, no adjacent changes)

---

## Phase 1: Core Middleware Changes

### Step 1A: Edit `server/replitAuth.ts`

**File:** `/Users/sammcdonnell/Documents/GlasApp/server/replitAuth.ts`

**Current Location:** Lines 182-196 (isAuthenticated function)

**Action:** Replace the entire isAuthenticated middleware function

**Old Code (182-196):**
```typescript
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // In local development (non-Replit), allow all requests for testing
  if (!isReplitEnvironment) {
    console.log("🔓 Local dev mode - bypassing authentication");
    // Mock user for development
    req.user = {
      claims: {
        sub: "dev-user-123",
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }

  const user = req.user as unknown;

  if (!req.isAuthenticated() || !user?.claims) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken && user.expires_at && now > user.expires_at) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (refreshToken) {
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      console.error("Token refresh failed:", error);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  }
  
  return next();
};
```

**New Code:**
```typescript
/**
 * Middleware to verify user authentication
 *
 * Authentication logic:
 * 1. NODE_ENV=development: Allow dev-user-123 (local testing only)
 * 2. NODE_ENV=production: Require valid Supabase bearer token
 * 3. Replit environment: Use existing session-based auth
 *
 * This CRITICAL security middleware prevents unauthorized access.
 * All protected routes must use this middleware.
 *
 * @param req - Express request (may contain Authorization bearer token)
 * @param res - Express response
 * @param next - Next middleware
 *
 * Returns:
 * - 401 Unauthorized if authentication fails
 * - 200 with next() if authentication succeeds
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // GATE 1: Development mode allows dev-user-123 for local testing
  if (process.env.NODE_ENV === 'development' && !isReplitEnvironment) {
    console.log("🔓 Local dev mode - dev-user-123 active (development only)");
    req.user = {
      claims: {
        sub: "dev-user-123",
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }

  // GATE 2: Production requires bearer token validation
  if (process.env.NODE_ENV === 'production') {
    try {
      const { getUserFromRequest } = await import('./auth/supabaseAuth.js');
      const user = await getUserFromRequest(req);
      
      if (!user) {
        return res.status(401).json({ 
          message: "Unauthorized - invalid or missing bearer token" 
        });
      }
      
      req.user = user;
      return next();
    } catch (error) {
      console.error("Bearer token validation failed:", error);
      return res.status(401).json({ 
        message: "Unauthorized - token validation error" 
      });
    }
  }

  // GATE 3: Replit environment uses session-based auth
  if (isReplitEnvironment) {
    const user = req.user as unknown;

    if (!req.isAuthenticated() || !user?.claims) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (user.expires_at && now > user.expires_at) {
      const refreshToken = user.refresh_token;
      if (!refreshToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        const config = await getOidcConfig();
        const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
        updateUserSession(user, tokenResponse);
      } catch (error) {
        console.error("Token refresh failed:", error);
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    return next();
  }

  // DEFAULT: No auth method available - reject
  console.error("⚠️  No authentication method available (NODE_ENV and REPLIT_DOMAINS not set)");
  return res.status(401).json({ message: "Unauthorized" });
};
```

**Changes Made:**
- Added NODE_ENV check at line 184 (was missing)
- Gate dev-user-123 to development ONLY
- Added production bearer token validation
- Added JSDoc with security documentation
- Kept Replit session auth intact
- Changed error messages to indicate missing bearer token

**Testing:** After change:
```bash
# Development: Should allow dev-user-123
NODE_ENV=development npm run dev

# Production: Should require bearer token
NODE_ENV=production npm run start
```

---

### Step 1B: Edit `server/middleware/sessionMiddleware.ts`

**File:** `/Users/sammcdonnell/Documents/GlasApp/server/middleware/sessionMiddleware.ts`

**Current Location:** Lines 30-39 (isAuthenticated function)

**Action:** Add bearer token fallback check

**Old Code (30-39):**
```typescript
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};
```

**New Code:**
```typescript
/**
 * Session-based authentication middleware
 *
 * Checks for authentication via:
 * 1. Express session (from Replit/OAuth)
 * 2. Bearer token in Authorization header (Supabase JWT)
 *
 * This middleware allows multiple auth methods to coexist.
 *
 * Returns:
 * - 200 with next() if authenticated via session or bearer
 * - 401 if neither method succeeds
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  // Check 1: Session-based auth (Replit)
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Check 2: Bearer token auth (Supabase) - fallback
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      // Import and use Supabase bearer validation
      const { getUserFromRequest } = await import('../auth/supabaseAuth.js');
      const user = await getUserFromRequest(req);
      
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      console.debug('Bearer token validation failed:', error);
      // Fall through to 401
    }
  }
  
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};
```

**Changes Made:**
- Added async function signature (was sync)
- Added bearer token fallback check
- Import getUserFromRequest from supabaseAuth
- Added JSDoc documentation
- Clear error handling

**Testing:** After change:
```bash
# Session auth should still work
# Bearer token auth should now work as fallback
```

---

## Phase 2: Client-Side Bearer Attachment

### Step 2A: Edit `client/src/lib/queryClient.ts`

**File:** `/Users/sammcdonnell/Documents/GlasApp/client/src/lib/queryClient.ts`

**Current Location:** Lines 17-33 (apiRequest function) and Lines 45-60 (getQueryFn)

**Action:** Add bearer token attachment to fetch calls

**Old Code (Lines 17-33):**
```typescript
export async function apiRequest<T = any>(options: ApiRequestOptions): Promise<T> {
  const { method, path, body, on401 = "throw" } = options;
  
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  await throwIfResNotOk(res);
  return await res.json();
}
```

**New Code:**
```typescript
/**
 * Make an API request with automatic bearer token attachment
 *
 * This function:
 * 1. Gets the Supabase JWT token from localStorage
 * 2. Attaches it as Authorization: Bearer header
 * 3. Sends the request (with session credentials)
 *
 * Without the bearer token, the server will return 401 Unauthorized.
 *
 * @param options - { method, path, body, on401 }
 * @returns Parsed JSON response
 * @throws If response is not ok (unless on401="returnNull")
 */
export async function apiRequest<T = any>(options: ApiRequestOptions): Promise<T> {
  const { method, path, body, on401 = "throw" } = options;
  
  // CRITICAL: Get bearer token from localStorage
  // This token is set by auth routes after successful login
  let token: string | null = null;
  try {
    const tokenData = localStorage.getItem('supabase.auth.token');
    if (tokenData) {
      // Token might be JSON-encoded or plain string
      try {
        const parsed = JSON.parse(tokenData);
        token = parsed.access_token || parsed;
      } catch {
        token = tokenData;
      }
    }
  } catch (error) {
    console.debug('Error reading bearer token from localStorage:', error);
  }
  
  // Build headers
  const headers: Record<string, string> = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  await throwIfResNotOk(res);
  return await res.json();
}
```

**Old Code (Lines 45-60, getQueryFn):**
```typescript
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };
```

**New Code:**
```typescript
/**
 * Query function factory with automatic bearer token attachment
 *
 * Used by React Query to fetch data. Automatically includes:
 * - Supabase JWT bearer token from localStorage
 * - Session credentials (cookies)
 *
 * Without bearer token, server returns 401 Unauthorized.
 *
 * @param on401 - How to handle 401: "throw" (default) or "returnNull"
 * @returns QueryFunction for React Query
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // CRITICAL: Get bearer token from localStorage
    let token: string | null = null;
    try {
      const tokenData = localStorage.getItem('supabase.auth.token');
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          token = parsed.access_token || parsed;
        } catch {
          token = tokenData;
        }
      }
    } catch (error) {
      console.debug('Error reading bearer token:', error);
    }

    // Build headers with bearer token
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };
```

**Changes Made:**
- Extract bearer token from localStorage in apiRequest
- Extract bearer token from localStorage in getQueryFn
- Add Authorization header with bearer token
- Add JSDoc with security explanation
- Handle token parsing (JSON or plain string)
- Fallback gracefully if token not available (header just won't be set)

**Testing:** After change:
```bash
# Open browser DevTools → Application → LocalStorage
# After login, should see 'supabase.auth.token' in localStorage
# All API requests should include Authorization header
```

---

## Phase 3: Documentation & Safety

### Step 3A: Edit `server/auth/supabaseAuth.ts`

**File:** `/Users/sammcdonnell/Documents/GlasApp/server/auth/supabaseAuth.ts`

**Current Location:** Lines 53-76 (getUserFromRequest function)

**Action:** Add JSDoc documentation explaining security

**Add above line 50:**
```typescript
/**
 * CRITICAL SECURITY FUNCTION
 *
 * Extract and verify user identity from Bearer JWT token
 *
 * This is the CORE security control that prevents:
 * - Unauthenticated access
 * - Fake dev-user-123 identity in production
 * - Unauthorized operations on protected routes
 *
 * SECURITY PROPERTIES:
 * 1. Returns null if no Authorization header (no implicit trust)
 * 2. Verifies JWT signature with Supabase (tampering impossible)
 * 3. Validates token expiration (expired tokens rejected)
 * 4. All protected routes call this function (via isAuthenticated middleware)
 *
 * FLOW:
 * Client Request:
 *   GET /api/quiz/save
 *   Authorization: Bearer eyJhbGc...
 *
 * Server Processing (this function):
 *   1. Extract token from Authorization header
 *   2. Call supabase.auth.getUser(token) - verifies JWT
 *   3. Return user object (verified) or null (invalid)
 *   4. Middleware responds 200 or 401 based on result
 *
 * DEPLOYMENT:
 * - Must be called by isAuthenticated() middleware on all protected routes
 * - Client must attach bearer token via queryClient.ts
 * - Supabase auth session must set token in localStorage
 *
 * TEST:
 * - Unauthenticated request (no token) → null → 401 Unauthorized
 * - Authenticated request (valid token) → user → 200 OK
 * - Tampered token → null → 401 Unauthorized
 * - Expired token → null → 401 Unauthorized
 */
```

**No code changes to the function itself, but add JSDoc.**

---

### Step 3B: Edit `server/db.ts`

**File:** `/Users/sammcdonnell/Documents/GlasApp/server/db.ts`

**Current Location:** Lines 33-54 (supabaseDb initialization)

**Action:** Add JSDoc warning about RLS bypass

**Replace line 33 with:**
```typescript
/**
 * Supabase REST Client with SERVICE_ROLE_KEY
 *
 * WARNING: This client BYPASSES Row-Level Security (RLS)
 *
 * RLS is the permission system that controls:
 * - Which rows a user can read/write
 * - Typically enforces: user_id = auth.uid()
 *
 * By using SERVICE_ROLE_KEY, this client ignores RLS policies.
 * It has full access to all data in all tables.
 *
 * SAFE USES (service-role client):
 * 1. Admin operations (batch deletes, data fixes)
 * 2. System jobs (news scraping, background tasks)
 * 3. Analytics (cross-user aggregations)
 *
 * UNSAFE USES (would expose data):
 * - User requests with service-role client
 * - Public API endpoints using service-role
 * - Anything user-input-influenced
 *
 * CORRECT USER REQUEST FLOW:
 * 1. Client attaches bearer token from localStorage
 * 2. Server receives Authorization header
 * 3. Server calls getUserFromRequest() → extracts user from token
 * 4. Server uses user.id with Supabase client (normal role, respects RLS)
 * 5. Supabase RLS policies enforce row-level permissions
 *
 * DO NOT use supabaseDb for user requests.
 * DO use supabaseDb for admin/system operations only.
 */
```

**No code changes, only documentation.**

---

## Phase 4: Testing

### Step 4A: Create Integration Test

**File:** `test/integration/auth-bypass-prevention.test.ts`

**Status:** Already created in audit phase

**Action:** No changes needed. Test file is ready.

**To run tests:**
```bash
npm test -- test/integration/auth-bypass-prevention.test.ts
```

---

## Phase 5: Verification & Commit

### Step 5A: TypeScript Check

**Before committing, run:**
```bash
npm run check
```

**Expected output:**
```
✓ No TypeScript errors
```

### Step 5B: Grep for dev-user-123 References

**After implementation, run:**
```bash
grep -r "dev-user-123" server --exclude-dir=node_modules
```

**Expected output:**
```
server/replitAuth.ts:188:        sub: "dev-user-123", // ONLY for local development
server/replitAuth.ts:189:        email: "dev@localhost",
(Only in replitAuth.ts with NODE_ENV=development guard)
```

**Must NOT appear in:**
- server/routes.ts
- server/db.ts
- server/auth/supabaseAuth.ts
- server/middleware/sessionMiddleware.ts (production path)
- client/src/**/*.ts

### Step 5C: Verify File Changes (7 files)

**Run:**
```bash
git status
```

**Expected files modified:**
1. server/replitAuth.ts
2. server/middleware/sessionMiddleware.ts
3. client/src/lib/queryClient.ts
4. server/auth/supabaseAuth.ts (comments only)
5. server/db.ts (comments only)
6. test/integration/auth-bypass-prevention.test.ts (created)

**Must NOT modify:**
- server/routes.ts (verify-only in audit)
- client/src/lib/api-helper.ts (doesn't exist; bearer attachment is in queryClient.ts)

### Step 5D: Stage and Commit Changes

**Phase 1 Commit:**
```bash
git add server/replitAuth.ts server/middleware/sessionMiddleware.ts

git commit -m "chore: remove dev-user-123 bypass, gate to NODE_ENV=development

Remove the critical auth bypass vulnerability where any unauthenticated request
in non-Replit environment was granted dev-user-123 identity.

CHANGES:
- server/replitAuth.ts: Gate dev-user-123 to NODE_ENV=development only
  - Production now requires valid Supabase bearer token
  - Add getUserFromRequest() call for token validation
  - Add JSDoc explaining security flow
  
- server/middleware/sessionMiddleware.ts: Add bearer token fallback
  - Check session first (Replit auth)
  - Fall back to bearer token (Supabase auth)
  - Async function to support token validation

SECURITY:
- Unauthenticated requests in production now return 401
- All protected routes require valid Supabase JWT
- No implicit trust based on environment

TESTING:
- test/integration/auth-bypass-prevention.test.ts created
- Tests verify 401 on missing bearer (was broken before)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

**Phase 2 Commit:**
```bash
git add client/src/lib/queryClient.ts

git commit -m "feat: attach Supabase bearer token to all client requests

Wire client-side bearer token attachment to enable authentication flow.

CHANGES:
- client/src/lib/queryClient.ts:
  - Extract bearer token from localStorage (set by auth routes)
  - Attach as Authorization: Bearer header on all requests
  - Handle both apiRequest() and getQueryFn() (React Query)
  - Graceful fallback if token not available

FLOW:
- User logs in → Supabase stores JWT in localStorage
- queryClient.ts reads token on every API call
- Attaches Authorization header
- Server validates token with Supabase (via isAuthenticated middleware)
- Returns 200 if valid, 401 if invalid

SECURITY:
- Without bearer token, server returns 401 Unauthorized
- Token is verified by Supabase (JWT signature check)
- Tampered tokens are rejected

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

**Phase 3 Commit:**
```bash
git add server/auth/supabaseAuth.ts server/db.ts

git commit -m "docs: add auth middleware and RLS bypass documentation

Add JSDoc and comments explaining security-critical functions.

CHANGES:
- server/auth/supabaseAuth.ts: Add JSDoc to getUserFromRequest()
  - Explain CRITICAL security function
  - Document how token verification prevents unauthorized access
  - Explain test cases (authenticated, unauthenticated, tampered)
  
- server/db.ts: Add RLS bypass warning for supabaseDb
  - Explain service-role client bypasses RLS
  - Document safe uses (admin, jobs, analytics)
  - Document unsafe uses (user requests would expose data)
  - Explain correct flow (user request → bearer token → RLS enforcement)

SECURITY:
- Developers understand security implications
- Service-role client is clearly marked as dangerous
- Correct usage patterns documented

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

**Phase 4 Commit:**
```bash
git add test/integration/auth-bypass-prevention.test.ts

git commit -m "test: add auth integration tests for bypass prevention

Add comprehensive tests verifying the auth bypass fix.

CHANGES:
- test/integration/auth-bypass-prevention.test.ts (new file)
  - Suite 1: Unauthenticated requests return 401
  - Suite 2: Bearer token validation works
  - Suite 3: Dev-mode dev-user-123 is gated correctly
  - Suite 4: Code inspection (no dev-user-123 in production)
  - Suite 5: All HTTP methods require auth

TEST CASES:
- GET without bearer → 401 (core security test)
- POST without bearer → 401
- Admin endpoint without bearer → 401
- Valid bearer → 200
- Invalid bearer → 401
- Tampered token → 401
- NODE_ENV=development allows dev-user-123
- NODE_ENV=production rejects dev-user-123

COVERAGE:
- Auth middleware tested
- Bearer validation tested
- Dev-mode gating tested
- All request types tested

To run:
  npm test -- test/integration/auth-bypass-prevention.test.ts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 6: Gate Verification

### Step 6A: Wait for Automated Gate

**After implementing all 4 commits, the automated gate-runner.sh will:**
1. Run TypeScript compilation
2. Run integration tests
3. Check method signatures
4. Audit call sites
5. Verify scope (7 files)
6. Check for dev-user-123 in production
7. Plus 6 more automated checks

**Expected output:**
```
GATE VERIFICATION RESULTS
========================
✓ Check 1: Scope verification (7 files)
✓ Check 2: Method signature completeness
✓ Check 3: Call site audit
✓ Check 4: TypeScript compilation
✓ Check 5: No dev-user-123 in production
✓ Check 6: Test coverage >= 80%
✓ Check 7: Integration tests pass
✓ Check 8: No regressions
✓ Check 9: JSDoc completeness
✓ Check 10: Migration safety
✓ Check 11: Documentation completeness
✓ Check 12: Performance (no regressions)

OVERALL: PASS (12/12)
```

### Step 6B: If Gate Fails

**Identify failure:**
1. Read gate report (will specify file, line, check number)
2. Fix code
3. Commit new fix (new commit, don't amend)
4. Gate re-runs

**Retry attempts:** Up to 3

---

## Checklist Summary

### Pre-Implementation
- [x] Audit complete
- [x] Vulnerability understood
- [x] Implementation plan documented
- [x] Failing test created
- [x] 7-file scope declared

### Phase 1: Middleware Changes
- [ ] Edit server/replitAuth.ts (replace isAuthenticated function)
- [ ] Edit server/middleware/sessionMiddleware.ts (add bearer fallback)
- [ ] npm run check (TypeScript)
- [ ] Commit Phase 1

### Phase 2: Client Bearer Attachment
- [ ] Edit client/src/lib/queryClient.ts (add bearer token)
- [ ] npm run check (TypeScript)
- [ ] Commit Phase 2

### Phase 3: Documentation
- [ ] Add JSDoc to server/auth/supabaseAuth.ts (getUserFromRequest)
- [ ] Add RLS warning to server/db.ts (supabaseDb)
- [ ] Commit Phase 3

### Phase 4: Testing
- [ ] Verify test/integration/auth-bypass-prevention.test.ts exists
- [ ] npm test (run tests)
- [ ] Commit Phase 4

### Phase 5: Verification
- [ ] npm run check (TypeScript compilation)
- [ ] grep -r "dev-user-123" server (check references)
- [ ] git status (verify 7 files modified)
- [ ] Review commit messages

### Phase 6: Gate
- [ ] Wait for automated gate to run
- [ ] Verify 12/12 checks pass
- [ ] Ready for production deployment

---

## Success Criteria

- [x] Vulnerability audit complete
- [ ] Implementation complete
- [ ] All 4 phases committed
- [ ] TypeScript compilation passes
- [ ] Integration tests pass
- [ ] Gate verification passes (12/12)
- [ ] Ready for production

---

## Key Reminders

1. **7-File Scope:** Only modify these 7 files (no adjacent refactoring)
2. **No Amending:** Create new commits for fixes, don't amend
3. **Commit Messages:** Include all changes in message (gate references them)
4. **Test Before Commit:** npm run check before each commit
5. **Gate Auto-Runs:** Phase end triggers automated 12-check gate
6. **Production Impact:** High risk (breaks auth if not complete)—must be atomic

---

## Implementation Ready

All preparation complete. Implementation can begin immediately.

Start with Phase 1: Edit server/replitAuth.ts

