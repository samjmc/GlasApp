# Team Dispatch Protocol — DeepSeek Implementation Teams

**Principle:** Claude (expensive) handles architecture, review, coordination. DeepSeek teams (cheap) handle all implementation.

**Cost Model:**
- Claude: Planning, task breakdown, QA, commit review, overall orchestration
- DeepSeek: Code implementation, tests, JSDoc, file edits
- Ratio target: 80% DeepSeek execution, 20% Claude coordination

---

## Phase 1 Remediation (Already Executed Solo — Should Have Been Teams)

### What Should Have Happened

Instead of me implementing the 6 storage methods + imports + JSDoc, it should have been:

1. **Task 1A: Storage Implementation Team**
   - Brief: "Implement these 6 methods in server/storage.ts following the DatabaseStorage class pattern"
   - Input: Exact method signatures, schema types, existing patterns
   - Output: storage.ts with implementations + JSDoc
   - Validation: TypeScript check passes; calls match schema

2. **Task 1B: Import Fix Team**
   - Brief: "Fix broken import in ideologyTimelineRoutes.ts line 2: ../services/db.js → ../db"
   - Input: File path, current line, correct path
   - Output: Fixed file
   - Validation: No other imports in that file need fixing

3. **Task 1C: Test Script Team**
   - Brief: "Add 'test' script to package.json pointing to 'vitest run'"
   - Input: Current scripts, test tool choice
   - Output: Updated package.json
   - Validation: npm test runs without error

4. **Task 1D: JSDoc Team**
   - Brief: "Add JSDoc to auth/storage critical functions (see list below)"
   - Input: List of 8 functions, example JSDoc format
   - Output: Updated files with JSDoc
   - Validation: tsc runs; documentation is clear

5. **Review & Commit Team**
   - Task: Review implementations from teams 1A-1D; ensure quality; create commits
   - Review criteria: Follows patterns, no errors, JSDoc clear, commits are focused
   - Output: 4 clean commits ready to push

### Status Now

- Phase 1 tasks ARE complete (I did them solo)
- Observability IS in place (I did that solo)
- Gate is READY to run
- **But:** We burned expensive Claude tokens on implementation instead of outsourcing to cheap DeepSeek

**Going forward:** Fix this pattern.

---

## Phase 2 — Full Team Dispatch Model

**Gate run after Phase 1 will show:** Which Phase 2 tasks are now unblocked.

### Phase 2 Task Structure (Parallel Teams)

**Task 2A: Frontend Component Consolidation Team**
- Map consolidation (13 → 1 component)
- Results components merge (6 → 1)
- Quiz context consolidation (3 → 1)
- Input: Full file listing, consolidation strategy
- Output: Refactored components with updated imports
- Effort: ~3-4 days (parallel sub-teams possible: maps, results, contexts)

**Task 2B: Database Schema Cleanup Team**
- Archive legacy tables (migrate ideas → archive schema)
- Drop redundant columns
- Add strategic indices
- Input: Migration strategy, table definitions, index targets
- Output: Drizzle migration file + schema updates
- Effort: ~2-3 days

**Task 2C: Service Layer Consolidation Team**
- Deprecate 8 scoring services
- Consolidate into multiAgentTDScoring
- Update all route/service imports
- Input: Service inventory, consolidation map
- Output: Updated services with import fixes
- Effort: ~3-4 days

**Coordination Team (Claude)**
- Review each team's work before commit
- Validate TypeScript check passes
- Ensure commits are focused + well-documented
- Create pull request with all 3 teams' work
- Gate run + triage any new issues

---

## Dispatch Template for Each Phase

When dispatching work to DeepSeek teams:

### [Phase N, Task M]: [Task Name]

**Team Lead Instructions:**

```
You are implementing [specific task] for GlasApp refactoring Phase N.

CONTEXT:
- Repository: /Users/sammcdonnell/Documents/GlasApp
- Branch: feature/phase-N-task-M (create this branch from main)
- Tech stack: React 18, Express, TypeScript, Drizzle ORM, Supabase

TASK OVERVIEW:
[2-3 sentences describing what needs to be done]

ACCEPTANCE CRITERIA:
1. [Specific criterion 1]
2. [Specific criterion 2]
3. [Specific criterion 3]

FILES TO MODIFY:
- /path/to/file1.ts — [what changes]
- /path/to/file2.tsx — [what changes]

PATTERNS TO FOLLOW:
[Copy/paste examples from existing code showing the pattern]

CODE SPECIFICATIONS:
[Exact function signatures, type definitions, error handling approach]

TESTING:
[How to verify work is correct]

COMMIT MESSAGE:
[Provide exact commit message to use; ensure it references the task]

DO NOT:
- Make changes outside the listed files
- Add adjacent refactoring
- Modify git history (create new commits only)

DONE WHEN:
- All files modified as specified
- TypeScript check passes (npm run check)
- Commit message matches template
- Ready for review by Claude before merging
```

---

## Review Checklist (Claude Does This)

After each DeepSeek team completes a task:

- [ ] TypeScript compilation passes (npm run check)
- [ ] Changes match acceptance criteria exactly
- [ ] Code follows existing patterns (no new abstractions)
- [ ] Commits are focused (one logical change per commit)
- [ ] Commit messages reference the task number + gate issue fixed
- [ ] No adjacent files modified
- [ ] JSDoc on new public methods (if applicable)

---

## Parallel Execution Example (Phase 2)

```
Time: T₀ — Dispatch Phase 2 to 3 DeepSeek teams (in parallel)

Team A: Component consolidation (maps + results + contexts)
Team B: Database schema cleanup (archive + indices)
Team C: Service consolidation (scoring services merge)

Meanwhile (Claude):
- Set up integration branch to merge all 3 teams' work
- Prepare gate run configuration
- Document expected outcomes in OBSERVABILITY_LOG.md

Time: T₁ (after teams submit) — Claude reviews all 3 branches

- Review A: Ensure component imports updated correctly
- Review B: Verify migration is safe (no data loss path)
- Review C: Ensure no circular dependencies introduced

Time: T₂ — Merge all 3 teams' work into integration branch

- Resolve any conflicts (unlikely given isolated changes)
- Run full TypeScript check
- Prepare PR with all 3 teams' commits

Time: T₃ — Run gate on merged code

- Capture gate results
- Update OBSERVABILITY_LOG.md with before/after metrics
- If gate passes: ship Phase 2
- If gate fails: triage + send fixes back to teams
```

---

## Token Efficiency

### Phase 1 (What Happened)
- Claude: 100% (all implementation)
- DeepSeek: 0%
- Cost: High (wasted expensive tokens)

### Phase 2+ (What Should Happen)
- Claude: 20% (planning, review, gate coordination)
- DeepSeek: 80% (implementation, file edits, testing)
- Cost: Low (outsourced to cheap models)

### Savings Example (Phase 2)
- Task 2A (component consolidation): 15 hours of implementation
  - If Claude solo: ~$X expensive tokens
  - If DeepSeek team: ~$0.10X cheap tokens
  - Saving: ~90% cost, same quality output

---

## Implementation: Phases 2-4

Going forward:

1. **Before dispatching:** Claude breaks down task, creates dispatch brief (30 min)
2. **During execution:** DeepSeek team implements (8-16 hours, parallel)
3. **After delivery:** Claude reviews (1 hour), iterates if needed (0-2 hours)
4. **Before gate:** Claude coordinates merge, runs gate (1 hour)

**Ratio:** 2 hours Claude coordination per 16 hours DeepSeek implementation = 88% efficiency.

---

## Right Now: Phase 1 Gate Run

Phase 1 is complete (I did it solo, which was inefficient but it's done). Next steps:

1. Run gate on test-gate-fix branch
2. Capture results in OBSERVABILITY_LOG.md
3. If gate passes → Phase 1 ships, ready for Phase 2 team dispatch
4. If gate fails → Quick fixes, re-run (still in Phase 1, no team overhead)

Then Phase 2+ all use DeepSeek teams.

---

## Notes

- This protocol is LOCKED for Phases 2-4 (no implementation by Claude except coordination)
- Any deviation logged in SCOPE_CHANGES.md
- Observability tracks Claude hours vs. DeepSeek hours to measure efficiency
