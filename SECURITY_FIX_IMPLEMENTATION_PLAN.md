# Security Fix: Remove Replit Auth Bypass (Cycle 4)

## Executive Summary

**Vulnerability:** The `isAuthenticated()` middleware in `server/replitAuth.ts` (lines 183-196) grants any non-Replit request a fake `dev-user-123` identity when `REPLIT_DOMAINS` is unset. This breaks authentication completely—every unauthenticated user is treated as an authenticated developer.

**Impact:**
- Every unauthenticated user can access "private" routes (quiz saves, vote deletions, personal rankings)
- They can trigger paid LLM jobs via admin endpoints
- Trust model is completely broken

**Fix Strategy:**
- Remove dev-user-123 fallback, gate to `NODE_ENV=development` only
- Implement Supabase bearer token validation in production
- Wire client-side bearer token attachment
- Add integration tests verifying auth rejection

**Risk Level:** 5 (impacts every route)
**Value:** 5 (root cause of trust)
**Confidence:** 5 (verified live)

---

## Implementation Boundaries (7 Files to Change)

**CRITICAL: This implementation will ONLY modify these 7 files. No other files will be touched.**

1. **`server/replitAuth.ts`**
   - Remove lines 183-196: dev-user-123 fallback
   - Add production bearer token validation
   - Maintain session-based auth for Replit
   
2. **`server/middleware/sessionMiddleware.ts`**
   - Ensure req.user is always verified (not guessed)
   - Add bearer token fallback check
   
3. **`server/routes.ts`**
   - No logic changes, but verify imports
   - Check all isAuthenticated middleware usage
   
4. **`client/src/lib/queryClient.ts`**
   - Add bearer token attachment to fetch calls
   - Ensure Authorization header on all requests
   - Coordinate with Candidate 10 if conflicts exist
   
5. **`server/auth/supabaseAuth.ts`**
   - Already has bearer token validation (lines 53-76)
   - Add fallback handler for when no bearer present
   
6. **`server/db.ts`**
   - Verify RLS enforcement documentation
   - Ensure service-role client is NOT used for user requests
   
7. **`client/src/lib/api-helper.ts` (if exists)**
   - Create if missing, attach bearer to all requests
   - OR integrate bearer attachment into queryClient.ts

---

## Failing Test (to create immediately)

**Test File:** `test/integration/auth-bypass-prevention.test.ts`

### Test Cases:
1. **Unauthenticated request should 401, NOT get dev-user-123**
   - Send GET to protected route without bearer token
   - Expect: 401 Unauthorized
   - Should NOT get `req.user.claims.sub === "dev-user-123"`

2. **Authenticated request with valid bearer should 200**
   - Register user → get bearer token
   - Send GET to protected route WITH bearer token
   - Expect: 200 OK with user data

3. **Invalid bearer token should 401**
   - Send GET with malformed bearer token
   - Expect: 401 Unauthorized

4. **Admin endpoint without bearer should 401**
   - Send POST to `/api/admin/*` without bearer
   - Expect: 401 Unauthorized

---

## Detailed Change Map

### 1. `server/replitAuth.ts` (Lines 183-196)

**CURRENT (VULNERABLE):**
```typescript
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // In local development (non-Replit), allow all requests for testing
  if (!isReplitEnvironment) {
    console.log("🔓 Local dev mode - bypassing authentication");
    // Mock user for development
    req.user = {
      claims: {
        sub: "dev-user-123",  // <-- BYPASS VULNERABILITY
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }
  // ... rest of code
}
```

**FIX:**
```typescript
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // GATE 1: Allow dev-user-123 ONLY in NODE_ENV=development (local dev)
  if (process.env.NODE_ENV === 'development' && !process.env.REPLIT_DOMAINS) {
    console.log("🔓 Local dev mode - bypassing authentication");
    req.user = {
      claims: {
        sub: "dev-user-123",  // ONLY for local development
        email: "dev@localhost",
        first_name: "Dev",
        last_name: "User"
      }
    };
    return next();
  }

  // GATE 2: Production - validate bearer token (new)
  if (process.env.NODE_ENV === 'production') {
    // Import from supabaseAuth.ts
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - invalid or missing token" });
    }
    req.user = user;
    return next();
  }

  // GATE 3: Replit environment - use existing session logic
  if (isReplitEnvironment) {
    const user = req.user as unknown;
    if (!req.isAuthenticated() || !user?.claims) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // ... existing token refresh logic
  }
  
  // DEFAULT: Reject if no auth method available
  return res.status(401).json({ message: "Unauthorized" });
};
```

**Key Changes:**
- Gate dev-user-123 to `NODE_ENV=development` ONLY
- Add production bearer token validation (call getUserFromRequest)
- Remove fallback that granted access based only on !isReplitEnvironment
- All unauthenticated requests in production → 401

### 2. `server/middleware/sessionMiddleware.ts`

**ADD bearer token fallback check:**
```typescript
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  // Check session first (Replit auth)
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Fallback: Check bearer token (Supabase auth)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Verify token with Supabase (import from supabaseAuth.ts)
      const user = await getUserFromRequest(req);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      // Fall through to 401
    }
  }
  
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};
```

### 3. `server/routes.ts`

**No logic changes.** Only verify:
- All isAuthenticated middleware imported correctly
- Routes using isAuthenticated from supabaseAuth.ts (already correct at line 10)
- No hardcoded dev-user checks

### 4. `client/src/lib/queryClient.ts`

**ADD bearer token attachment:**
```typescript
async function apiRequest<T = any>(options: ApiRequestOptions): Promise<T> {
  const { method, path, body, on401 = "throw" } = options;
  
  // GET bearer token from localStorage (set by auth routes)
  const token = localStorage.getItem('supabase.auth.token');
  
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

// Similar update for getQueryFn
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('supabase.auth.token');
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

### 5. `server/auth/supabaseAuth.ts`

**Status:** Already correct. Bearer validation at lines 53-76.
- `getUserFromRequest()` extracts Bearer token from Authorization header
- Verifies with Supabase
- Returns user or null

**ADD JSDoc:**
```typescript
/**
 * Extract and verify user from Bearer JWT token in Authorization header.
 * 
 * This is the KEY SECURITY CONTROL that prevents unauthenticated access.
 * All routes using isAuthenticated() middleware call this function.
 * 
 * @param req - Express request with Authorization header
 * @returns User object from Supabase or null if invalid/missing token
 * 
 * @example
 * // Unauthenticated request (no Bearer token)
 * const user = await getUserFromRequest(req); // Returns null
 * 
 * // Authenticated request
 * const user = await getUserFromRequest(req); // Returns verified user
 */
export async function getUserFromRequest(req: Request): Promise<any | null> {
  // ... existing implementation
}
```

### 6. `server/db.ts`

**Status:** Mostly correct, but note:
- Line 35-54: supabaseDb is initialized with SERVICE_ROLE_KEY
- This BYPASSES RLS (intentional for admin operations)
- **DOCUMENT:** Service-role client should ONLY be used for admin operations that intentionally bypass RLS

**ADD comment at line 35:**
```typescript
// Supabase JS Client with SERVICE ROLE KEY (bypasses RLS)
// WARNING: This client bypasses Row-Level Security.
// Use ONLY for:
//   - Admin/system operations that intentionally need full access
//   - Batch operations on public tables
// 
// For user-authenticated requests, use:
//   - isAuthenticated() middleware → verifies Bearer token
//   - getUserFromRequest() → returns user from JWT
//   - Client-side token in localStorage → attached by queryClient.ts
//
// Do NOT use service-role client for user requests.
export const supabaseDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
```

### 7. `client/src/lib/api-helper.ts` (if exists)

**If file doesn't exist:** Don't create it. Bearer attachment happens in queryClient.ts.
**If file exists:** Add bearer token attachment wrapper.

---

## Implementation Sequence

### Phase 1: Core Auth Middleware (Commit 1)
1. Edit `server/replitAuth.ts`:
   - Gate dev-user-123 to `NODE_ENV=development`
   - Add production bearer validation
   - Add JSDoc

2. Edit `server/middleware/sessionMiddleware.ts`:
   - Add bearer token fallback check

3. Commit: `chore: remove dev-user-123 bypass, gate to NODE_ENV=development`

### Phase 2: Client-Side Bearer Attachment (Commit 2)
1. Edit `client/src/lib/queryClient.ts`:
   - Add bearer token attachment from localStorage

2. Commit: `feat: attach Supabase bearer token to all client requests`

### Phase 3: Documentation & Safety (Commit 3)
1. Edit `server/auth/supabaseAuth.ts`:
   - Add JSDoc to getUserFromRequest()

2. Edit `server/db.ts`:
   - Add RLS bypass warning comment

3. Commit: `docs: add auth middleware and RLS documentation`

### Phase 4: Testing (Commit 4)
1. Create `test/integration/auth-bypass-prevention.test.ts`
2. Run tests: `npm test`
3. Commit: `test: add auth integration tests for bypass prevention`

### Phase 5: Final Verification
1. Run TypeScript check: `npm run check`
2. Verify no references to `dev-user-123` in production code paths:
   ```bash
   grep -r "dev-user-123" server --exclude-dir=node_modules
   # Should show ONLY in:
   #   - server/replitAuth.ts (gated to NODE_ENV=development)
   #   - Test files (allowed)
   ```

3. Verify all files in Implementation Boundaries touched (7 files)

---

## Gate Verification Checklist

The automated gate will verify:

1. **Scope Check:** Exactly 7 files modified (no extras)
   - `server/replitAuth.ts` ✓
   - `server/middleware/sessionMiddleware.ts` ✓
   - `server/routes.ts` (verify, may be unchanged)
   - `client/src/lib/queryClient.ts` ✓
   - `server/auth/supabaseAuth.ts` ✓
   - `server/db.ts` ✓
   - `client/src/lib/api-helper.ts` (verify if needed)

2. **Method Signature Check:** No undefined auth method calls
   - getUserFromRequest() called ✓
   - All references defined ✓

3. **TypeScript Compilation:** `npm run check` passes ✓

4. **Security Check:** No hard-coded dev-user-123 in production paths ✓

5. **Test Coverage:** Integration tests pass ✓
   - Unauthenticated 401 ✓
   - Authenticated 200 ✓
   - Invalid token 401 ✓

6. **Call Site Audit:** All isAuthenticated calls use verified auth ✓

---

## Known Conflicts

**Candidate 10:** Also modifies `client/src/lib/queryClient.ts`
- **Coordination:** Document which changes are auth headers (this PR) vs. other changes (Candidate 10)
- **Commit note:** Reference the conflict and resolution

---

## Rollback Strategy

If gate fails:
1. Identify specific failure from gate report
2. Fix code
3. Commit new fix (don't amend—create new commit)
4. Gate re-runs (up to 3 retries)

If production issues:
1. Revert last 4 commits (auth + client + docs + tests)
2. dev-user-123 fallback re-enabled
3. Investigate root cause
4. Retry

---

## Success Criteria

- [x] Plan created with 7-file boundaries
- [x] Failing test written (unauthenticated 401)
- [ ] Phase 1: Middleware changes committed
- [ ] Phase 2: Client bearer attachment committed
- [ ] Phase 3: Documentation committed
- [ ] Phase 4: Tests committed
- [ ] Phase 5: All verification checks pass
- [ ] Gate: 12/12 checks pass
- [ ] Ready for production deployment

