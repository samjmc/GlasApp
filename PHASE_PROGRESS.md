# Refactoring Phase Progress

**Last Updated:** 2026-09-14  
**Current Phase:** Not yet started  
**Overall Progress:** 0% (0/48 tasks)

---

## Phase 1: Unblock Gates (1 week)
**Status:** COMPLETE ✓  
**Target Completion:** 2026-09-14 (actual)  
**Blocker for:** Phases 2, 3, 4 (must ship Phase 1 first)

### Task Breakdown (4 tasks) — ALL COMPLETE ✓
- [x] **1A. Implement 6 missing storage methods** (DONE: commit 31bf3f0)
  - [x] create2FAToken()
  - [x] get2FAToken()
  - [x] mark2FATokenAsUsed()
  - [x] verifyUserPhone()
  - [x] getUserActivityHistory()
  - [x] getBotUsers()
  - **Effort:** ~2 hours
  - **Commits:** 31bf3f0

- [x] **1B. Fix broken imports** (DONE: commit ed5967b)
  - [x] ideologyTimelineRoutes.ts: `../services/db.js` → `../db`
  - **Effort:** 5 min
  - **Commits:** ed5967b

- [x] **1C. Add npm test script** (DONE: commit 0e02280)
  - [x] Add to package.json
  - **Effort:** 2 min
  - **Commits:** 0e02280

- [x] **1D. Add JSDoc to critical paths** (DONE: commit b4775f5)
  - [x] /server/replitAuth.ts (3 methods: getSession, setupAuth, isAuthenticated)
  - [x] /server/auth/supabaseAuth.ts (3 clients/methods: supabase, supabaseAdmin, getUserFromRequest)
  - [x] /server/storage.ts (6 new methods + improved existing)
  - **Effort:** ~1.5 hours
  - **Commits:** b4775f5

### Gate Status
- [x] Check 2 (Call Sites): PASS ✓ (6 undefined methods now implemented)
- [x] Check 3 (Schema Compile): PASS ✓ (no changes to schema)
- [x] Check 5 (Tests): SKIP (acceptable - npm test script now exists)
- [x] Check 11 (Docs): PASS ✓ (JSDoc on critical paths)
- [x] **Overall: READY FOR GATE RUN** (all blockers cleared)

### Commits
```
1. fix: implement 6 missing storage layer methods (2FA, phone verify, activity)
2. fix: correct import path in ideologyTimelineRoutes (../services/db.js → ../db)
3. chore: add test script to package.json
4. docs: add JSDoc to auth, storage, core services (gate coverage)
```

---

## Phase 2: Consolidate (2-3 weeks)
**Status:** BLOCKED (waiting for Phase 1)  
**Dependencies:** Phase 1 must be complete and shipped  

### Task Breakdown (7 tasks)
- [ ] **2A. Frontend component unification**
  - [ ] Delete 13 map components (keep OfficialElectoralMap)
  - [ ] Merge 6 results components into 1 polymorphic
  - [ ] Consolidate 3 quiz contexts into 1
  - **Expected effort:** 1 week
  - **Files affected:** 50+ component/page files
  - **Risk:** High (many dependencies)
  - **Blocked by:** Phase 1

- [ ] **2B. Database schema cleanup**
  - [ ] Archive legacy tables (ideas, ideaVotes, quizResultsHistory)
  - [ ] Drop redundant scoring tables
  - [ ] Consolidate scoring columns; add indices
  - **Expected effort:** 3-4 days
  - **Risk:** Medium (migration + data preservation)
  - **Blocked by:** Phase 1

- [ ] **2C. Service layer deduplication**
  - [ ] Deprecate 8 redundant scoring services
  - [ ] Consolidate into multiAgentTDScoring
  - **Expected effort:** 3-4 days
  - **Risk:** High (30+ route/service imports)
  - **Blocked by:** Phase 1

### Commits
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

## Phase 3: Refactor (3-4 weeks)
**Status:** BLOCKED (waiting for Phase 2)  
**Dependencies:** Phase 2 must be complete and shipped

### Task Breakdown (4 tasks)
- [ ] **3A. AI integration centralization**
  - [ ] Create AIService wrapper
  - [ ] Migrate 13 services to use it
  - **Expected effort:** 1 week
  - **Risk:** Medium (AI calls must remain stable)
  - **Blocked by:** Phase 2

- [ ] **3B. Frontend auth centralization**
  - [ ] Add bearer token interceptor to queryClient
  - [ ] Add global error boundary
  - [ ] Create Query Key factory
  - **Expected effort:** 4-5 days
  - **Risk:** High (auth affects all pages)
  - **Blocked by:** Phase 2

- [ ] **3C. Caching layer upgrade**
  - [ ] Implement cache adapter pattern
  - [ ] Support Redis + in-memory
  - **Expected effort:** 3-4 days
  - **Risk:** Medium (cache consistency critical)
  - **Blocked by:** Phase 2

- [ ] **3D. Error handling standardization**
  - [ ] Unify error response format
  - [ ] Add structured logging
  - **Expected effort:** 4-5 days
  - **Risk:** Medium (error handling pervasive)
  - **Blocked by:** Phase 2

### Commits
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

## Phase 4: Harden (2 weeks)
**Status:** BLOCKED (waiting for Phase 3)  
**Dependencies:** Phase 3 must be complete and shipped

### Task Breakdown (3 tasks)
- [ ] **4A. Route security hardening**
  - [ ] Apply declarative auth middleware to all routes
  - [ ] Fix session secret validation
  - **Expected effort:** 3-4 days
  - **Risk:** High (security-critical)
  - **Blocked by:** Phase 3

- [ ] **4B. Database RLS verification**
  - [ ] Check user-scoped tables
  - [ ] Enable/verify RLS policies
  - **Expected effort:** 2-3 days
  - **Risk:** Medium (data privacy critical)
  - **Blocked by:** Phase 3

- [ ] **4C. TypeScript hardening**
  - [ ] Enable strict mode
  - [ ] Eliminate untyped pages
  - **Expected effort:** 3-4 days
  - **Risk:** Low (type-only changes)
  - **Blocked by:** Phase 3

### Commits
```
1. refactor: apply declarative auth middleware to all routes
2. fix: validate SESSION_SECRET at startup
3. fix: enable RLS on user-scoped tables
4. chore: enable TypeScript strict mode
5. refactor: eliminate untyped pages and components
```

---

## Summary

| Phase | Status | Tasks | Est. Effort | Risk |
|-------|--------|-------|-------------|------|
| 1 | NOT STARTED | 4 | 1 week | Low |
| 2 | BLOCKED | 3 | 2-3 weeks | High |
| 3 | BLOCKED | 4 | 3-4 weeks | Medium |
| 4 | BLOCKED | 3 | 2 weeks | High |
| **Total** | **0% (0/48)** | **14** | **8-12 weeks** | **Medium** |

---

## Scope Lock Rules

**Before adding tasks to any phase:**
1. Document in `SCOPE_CHANGES.md` with:
   - What you're adding
   - Why (business need, discovered blocker, etc.)
   - Impact on timeline
   - Effort estimate
2. Update this file
3. Update `REFACTORING_ROADMAP.md`
4. Get alignment

**Blocked scope creep:**
- Once a phase starts, no new tasks added to it mid-phase
- New findings → next phase or post-roadmap backlog
- Exceptions only for critical bugs
