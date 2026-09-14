# GlasApp Refactoring Roadmap

**Last Updated:** 2026-09-14  
**Status:** Blueprint phase  
**Scope:** Core architecture consolidation (8-12 weeks, 4 phases)

---

## Executive Summary

The codebase has a solid foundation (Supabase+Drizzle, service layer, scoring model) but suffers from:
- **Fragmentation:** 9 scoring services, 13 map components, 3 quiz contexts, 54 pages
- **Technical debt:** Missing storage methods, tight coupling, inconsistent auth, schema bloat
- **Operational gaps:** No tests, missing JSDoc, error handling chaos, unprotected routes

This roadmap prioritizes unblocking (Phase 1), then systematic consolidation (Phases 2-4).

---

## Phase 1: Unblock Gates (1 week) — IMMEDIATE

### Acceptance Criteria
- [ ] Gate passes (all 12 checks)
- [ ] No undefined storage method calls
- [ ] No broken imports
- [ ] npm test script exists
- [ ] Auth paths documented

### Tasks

**1A. Implement 6 Missing Storage Methods**
- **Files affected:**
  - `/server/storage.ts` — add implementations
  - `/server/services/authService.ts` — will call these
  - `/server/routes/authRoutes.ts` — will call these
- **Methods to add:**
  1. `create2FAToken(userId, token, type, expiresAt)` → returns TwoFactorToken
  2. `get2FAToken(userId, code, type)` → returns TwoFactorToken or null
  3. `mark2FATokenAsUsed(tokenId)` → marks used, returns void
  4. `verifyUserPhone(userId, code)` → returns boolean
  5. `getUserActivityHistory(userId, startDate)` → returns UserActivity[]
  6. `getBotUsers()` → returns User[]
- **Validation:** Grep confirms all 6 are called but not implemented

**1B. Fix Broken Imports**
- **File:** `/server/routes/ideologyTimelineRoutes.ts` line 2
- **Change:** `from '../services/db.js'` → `from '../db'`
- **Verify:** `npm run check` passes (TypeScript compilation)

**1C. Add npm test Script**
- **File:** `package.json` scripts
- **Current:** Missing
- **Add:** `"test": "vitest run"` (or placeholder `echo 'Tests coming soon'`)
- **Why:** Gate check #8 (Regression) requires npm test to exist

**1D. Add JSDoc to Critical Paths**
- **Target:** Auth, storage, core services (aim for 50-100 methods, ~4-6 hours)
- **Files:**
  - `/server/replitAuth.ts` — auth middleware
  - `/server/auth/supabaseAuth.ts` — bearer validation
  - `/server/storage.ts` — all public methods
  - `/server/services/authService.ts` — all exports
- **Format:**
  ```typescript
  /**
   * Short description of what this does.
   * 
   * @param param1 - what it is
   * @returns what it returns
   * @throws Error condition
   */
  export function methodName(param1: Type): ReturnType {
    // ...
  }
  ```

### Commits
```
1. fix: implement 6 missing storage layer methods (2FA, phone verify, activity)
2. fix: correct import path in ideologyTimelineRoutes (../services/db.js → ../db)
3. chore: add test script to package.json
4. docs: add JSDoc to auth, storage, core services (gate coverage)
```

### Gate Status After Phase 1
- Check 2 (Call Sites): PASS ✓
- Check 3 (Schema Compile): PASS ✓
- Check 5 (Tests): SKIP (acceptable)
- Check 11 (Docs): PASS ✓ (critical paths only)
- Overall: PASS (advance to review)

---

## Phase 2: Consolidate (2-3 weeks) — After Phase 1 shipped

### Acceptance Criteria
- [ ] Codebase size reduced ~15%
- [ ] No duplicate components/services/contexts
- [ ] All removed code documented (commit messages reference what/why)
- [ ] All consolidations tested locally

### Tasks

**2A. Frontend Component Unification**

*Delete 13 map components; standardize on OfficialElectoralMap*
- **Files to delete:** (keep OfficialElectoralMap.tsx only)
  - IrelandMap.tsx
  - MapboxIrelandMap.tsx
  - LeafletIrelandMap.tsx
  - ConstituencyMap.tsx
  - D3IrelandMap.tsx
  - ZoomableIrelandMap.tsx
  - CountyMapOfIreland.tsx
  - BasicIrelandMap.tsx
  - GeographicHeatMap.tsx
  - IrelandElectoralMap.tsx
  - InteractiveConstituencyMap.tsx
  - (2 more)
- **Verify:** Grep all usages; update imports in 5-8 page files
- **Commit:** `refactor: consolidate 13 map components → OfficialElectoralMap`

*Merge 6 results components into 1 polymorphic component*
- **Keep:** `EnhancedResultsPage.tsx` (most feature-complete)
- **Delete:** PartyMatchResults, PartyMatchResultsNew, ContextAwareResults, EnhancedPoliticalAnalysis, etc.
- **Union type:** `type ResultsView = 'party-match' | 'context-aware' | 'political-profile'`
- **Commit:** `refactor: merge 6 results components → polymorphic EnhancedResults`

*Consolidate 3 quiz contexts into 1*
- **Keep:** `QuizContext.tsx` (rename/refactor for clarity)
- **Delete:** QuizContextNew.tsx, MultidimensionalQuizContext.tsx
- **Migrate:** Update all page imports
- **Commit:** `refactor: consolidate quiz state → single QuizContext`

**2B. Database Schema Cleanup**

*Archive legacy tables (non-destructive)*
- **Create migration:** Create archive schema
  ```sql
  CREATE SCHEMA IF NOT EXISTS archive;
  ALTER TABLE ideas SET SCHEMA archive;
  ALTER TABLE idea_votes SET SCHEMA archive;
  ALTER TABLE quiz_results_history SET SCHEMA archive;
  ```
- **Verify:** No code references these before migration
- **Commit:** `chore: archive legacy tables (ideas, ideaVotes, quizResultsHistory)`

*Drop redundant scoring tables*
- **Drop:** performanceScores (duplicate of unifiedTDScores)
- **Migrate:** Copy data to unifiedTDScores if needed
- **Verify:** No foreign keys reference performanceScores
- **Commit:** `refactor: remove performanceScores table (superseded by unifiedTDScores)`

*Consolidate scoring table columns*
- **Remove:** ELO columns from unifiedTDScores if not used
- **Standardize:** All scores to decimal(5,2) format
- **Add indices:** `(userId)`, `(politicianName, createdAt)`
- **Commit:** `refactor: consolidate scoring tables; add indices`

**2C. Service Layer Duplication**

*Deprecate 8 redundant scoring services*
- **Keep only:** multiAgentTDScoring (most sophisticated)
- **Deprecate:** comprehensiveTDScoringService, personalizedScoringService, adaptiveScoringEngine, tdScoreCalculator, eloScoringService (→ utility functions only), etc.
- **Migration:** Update all route/service imports to use multiAgentTDScoring
- **Commit:** `refactor: consolidate 8 scoring services → multiAgentTDScoring`

### Commits (Phase 2)
```
1. refactor: consolidate 13 map components → OfficialElectoralMap
2. refactor: merge 6 results components → polymorphic component
3. refactor: consolidate quiz state → single QuizContext
4. chore: archive legacy tables (ideas, ideaVotes, quiz history)
5. refactor: remove performanceScores (superseded by unifiedTDScores)
6. refactor: add missing DB indices on frequently-queried columns
7. refactor: consolidate 8 scoring services → multiAgentTDScoring
```

---

## Phase 3: Refactor (3-4 weeks) — After Phase 2 shipped

### Acceptance Criteria
- [ ] No duplicate AI initialization code
- [ ] Auth token injection centralized
- [ ] No missing error boundaries
- [ ] Cache layer testable via Redis/in-memory adapter
- [ ] Zero tight coupling between route and service

### Tasks

**3A. AI Integration Centralization**

*Create unified AIService wrapper*
- **File:** `/server/services/aiService.ts` (new)
- **Exports:**
  ```typescript
  interface AIOptions {
    retries?: number;
    timeout?: number;
    fallbackToCache?: boolean;
  }
  
  export async function analyzeNews(
    article: NewsArticle,
    options?: AIOptions
  ): Promise<ArticleAnalysis>
  
  export async function scoreTextContent(
    text: string,
    dimension: string,
    options?: AIOptions
  ): Promise<number>
  
  export async function multiAgentConsensus(
    prompt: string,
    agents: string[],
    options?: AIOptions
  ): Promise<ConsensuResult>
  ```
- **Features:**
  - Retry logic (exponential backoff, max 3 attempts)
  - Fallback strategy (cache hit → return stale, timeout → return rule-based)
  - Cost tracking per call
  - Structured logging (operation, tokens, time, cost)
- **Migrate:** Update all 13 services to call through AIService
- **Commit:** `refactor: centralize AI integration → AIService wrapper`

**3B. Frontend Auth Centralization**

*Add global bearer token interceptor*
- **File:** `/client/src/lib/queryClient.ts`
- **Change:**
  ```typescript
  export const queryClient = new QueryClient({
    defaultOptions: { /* ... */ },
  });
  
  // Intercept all requests
  const originalRequest = queryClient.getQueryData;
  queryClient.getQueryData = async (options) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return originalRequest(options);
  }
  ```
- **Remove:** Manual bearer token injection from PolicyVotePrompt, dailySessionService, etc.
- **Test:** Verify all endpoints receive Authorization header
- **Commit:** `refactor: centralize auth token injection → queryClient interceptor`

*Add global error boundary*
- **File:** `/client/src/components/ErrorBoundary.tsx` (new)
- **Wraps:** `<App />` in main.tsx
- **Handles:** Async query failures, suspense boundaries
- **UX:** Toast notification + retry button
- **Commit:** `feat: add global error boundary for async failures`

*Create Query Key factory*
- **File:** `/client/src/lib/queryKeys.ts` (new)
- **Pattern:**
  ```typescript
  export const queryKeys = {
    td: {
      all: () => ['td'] as const,
      scores: (constituency: string) => [...queryKeys.td.all(), 'scores', constituency] as const,
      leaderboard: () => [...queryKeys.td.all(), 'leaderboard'] as const,
    },
    quiz: {
      all: () => ['quiz'] as const,
      result: (id: number) => [...queryKeys.quiz.all(), id] as const,
    },
    news: {
      all: () => ['news'] as const,
      byTD: (tdName: string) => [...queryKeys.news.all(), tdName] as const,
    },
  };
  ```
- **Use in pages:** `useQuery(queryKeys.td.scores(constituency))`
- **Commit:** `feat: add Query Key factory for cache consistency`

**3C. Caching Layer Upgrade**

*Replace in-memory cache with Redis adapter*
- **File:** `/server/services/cacheService.ts` (refactor)
- **Add adapter pattern:**
  ```typescript
  interface CacheAdapter {
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl: number): Promise<void>;
    del(key: string): Promise<void>;
  }
  
  class MemoryCacheAdapter implements CacheAdapter { /* ... */ }
  class RedisCacheAdapter implements CacheAdapter { /* ... */ }
  
  export const cache = process.env.REDIS_URL 
    ? new RedisCacheAdapter()
    : new MemoryCacheAdapter();
  ```
- **Benefits:** Multi-instance support, distributed cache, zero code changes
- **Test:** Run with both adapters
- **Commit:** `refactor: cache adapter pattern (Redis + in-memory support)`

**3D. Error Handling Standardization**

*Unified error response format*
- **Current:** Scattered `{success, message, error}` vs `{success, error}` vs `{error: string}`
- **Target:** All routes return:
  ```typescript
  {
    success: boolean;
    data?: T;
    error?: {
      code: string;           // 'AUTH_FAILED', 'NOT_FOUND', 'VALIDATION_ERROR'
      message: string;        // User-friendly message
      details?: string;       // Technical details (dev only)
    };
  }
  ```
- **Middleware:** Create `formatResponse()` helper
- **Commit:** `refactor: standardize error response format across all routes`

*Add structured logging*
- **Library:** Pino or Winston
- **Replace:** All `console.log/error` with structured logs
- **Fields:** timestamp, level, operation, userId, status, duration
- **Commit:** `feat: add structured logging to all services (Pino)`

### Commits (Phase 3)
```
1. refactor: centralize AI integration → AIService wrapper with retry/fallback
2. refactor: centralize auth token injection → queryClient interceptor
3. feat: add global error boundary for async failures
4. feat: add Query Key factory for cache consistency
5. refactor: cache adapter pattern (Redis + in-memory)
6. refactor: standardize error response format
7. feat: structured logging across all services
```

---

## Phase 4: Harden (2 weeks) — After Phase 3 shipped

### Acceptance Criteria
- [ ] All routes protected by explicit middleware (no inline checks)
- [ ] RLS enabled on user-scoped tables
- [ ] TypeScript strict mode enabled
- [ ] All `any` types eliminated or justified
- [ ] Production config validates secrets at startup

### Tasks

**4A. Route Security Hardening**

*Apply declarative auth middleware to all routes*
- **Current:** 46 routes lack explicit middleware; many check `req.session` inline
- **Change:** Use Express route guards
  ```typescript
  router.get('/protected', isAuthenticated, (req, res) => {
    // ...
  });
  ```
- **Audit:** Verify 100% of sensitive routes (POST, PUT, DELETE, /admin) have explicit guards
- **Commit:** `refactor: apply declarative auth middleware to all routes`

*Fix session secret validation*
- **File:** `/server/middleware/sessionMiddleware.ts`
- **Add:** Runtime check
  ```typescript
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET env var required in production');
  }
  ```
- **Commit:** `fix: validate SESSION_SECRET at startup (production safety)`

**4B. Database Security**

*Verify RLS on user-scoped tables*
- **Tables to check:** user_td_ratings, user_category_votes, user_pledge_votes, user_category_rankings, party_sentiment_votes
- **Policy needed:**
  ```sql
  ALTER TABLE user_category_votes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY user_category_votes_self ON user_category_votes
    USING (user_id = auth.uid());
  ```
- **Verify:** No select-all without auth filter
- **Commit:** `fix: enable RLS on user-scoped tables`

**4C. TypeScript Hardening**

*Enable strict mode*
- **File:** `tsconfig.json`
- **Add:**
  ```json
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
  ```
- **Fix errors:** Target 0 `any` types (or justified comments)
- **Commit:** `chore: enable TypeScript strict mode`

*Eliminate untyped pages*
- **Target:** Pages using `any` types (LocalRepresentativesPage, EducationPage, etc.)
- **Define:** Response types for each API call
- **Test:** `npm run check` passes with no warnings
- **Commit:** `refactor: add TypeScript types to all pages (eliminate any)`

### Commits (Phase 4)
```
1. refactor: apply declarative auth middleware to all routes
2. fix: validate SESSION_SECRET at startup
3. fix: enable RLS on user-scoped tables
4. chore: enable TypeScript strict mode
5. refactor: eliminate untyped pages and components
```

---

## Progress Tracking

Use `PHASE_PROGRESS.md` to track status. Template:

```markdown
# Phase Progress

## Phase 1: Unblock Gates (IN PROGRESS)
- [ ] 1A. Implement 6 missing storage methods
- [ ] 1B. Fix broken imports (ideologyTimelineRoutes.ts)
- [ ] 1C. Add npm test script
- [ ] 1D. Add JSDoc to critical paths
- [ ] Gate passes

## Phase 2: Consolidate (NOT STARTED)
- [ ] 2A. Frontend component unification (maps, results, quiz contexts)
- [ ] 2B. Database schema cleanup (archive legacy, drop duplicates)
- [ ] 2C. Service layer deduplication (8 → 1 scoring service)

## Phase 3: Refactor (NOT STARTED)
- [ ] 3A. AI integration centralization
- [ ] 3B. Frontend auth centralization
- [ ] 3C. Caching layer upgrade
- [ ] 3D. Error handling standardization

## Phase 4: Harden (NOT STARTED)
- [ ] 4A. Route security hardening
- [ ] 4B. Database RLS verification
- [ ] 4C. TypeScript hardening
```

---

## Scope Lock

**DO NOT CHANGE** this roadmap without:
1. Documenting the change in `SCOPE_CHANGES.md` (why, impact on timeline)
2. Updating affected phase sections
3. Re-estimating timeline
4. Getting alignment before proceeding

This prevents scope creep mid-phase.

---

## Related Documents

- `PHASE_PROGRESS.md` — Live status tracking
- `SCOPE_CHANGES.md` — Log of requested changes to this roadmap
- `REFACTORING_AUDIT.md` — Full 5-agent audit findings (source of truth for issues)
- Original audit files (in `/loop-state/tasks/`):
  - Database audit: ab6a68a933a24febf
  - Services audit: a5f95ee9a9913bfea
  - Frontend audit: a1d701b2fc5749a80
  - Routes audit: a1d209a95921a733e
  - Security audit: a82696931b67fad4c
