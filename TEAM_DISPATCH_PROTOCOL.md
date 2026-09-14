# Team Dispatch Protocol — DeepSeek Implementation Teams

**Principle:** Claude (expensive) handles architecture, review, coordination. DeepSeek teams (cheap) handle all implementation.

**Cost Model:**
- Claude: Planning, task breakdown, QA, commit review, overall orchestration
- DeepSeek: Code implementation, tests, JSDoc, file edits
- Ratio target: 80% DeepSeek execution, 20% Claude coordination

---

## THE ACTUAL DISPATCH MECHANISM (read this before dispatching anything)

**Corrected 2026-09-14 after a real cost-policy violation:** an entire prior session's worth of "DeepSeek team" dispatches were run through the `Agent` tool, whose `model` parameter only accepts `sonnet`/`opus`/`haiku` — there is no DeepSeek option in it. Labeling a subagent prompt "you are a DeepSeek team" does not change which model actually executes it. Every one of those dispatches silently ran on Sonnet at full Claude cost. The user caught this and it must not happen again, here or in any other project.

**The real mechanism is the `opencode` CLI via the `Bash` tool, not the `Agent` tool:**

```bash
opencode run --model opencode-go/deepseek-v4-flash --dir /Users/sammcdonnell/Documents/GlasApp "<full self-contained dispatch brief, same content as the template below>"
```

- Binary: `/Users/sammcdonnell/.opencode/bin/opencode` (verify with `which opencode`; confirm current DeepSeek model IDs with `opencode models | grep -i deepseek` since the list can change).
- Model choice: `opencode-go/deepseek-v4-flash` is the default for routine implementation. Use `opencode-go/deepseek-v4-pro` for harder/riskier multi-file tasks that still don't need Claude. Don't assume this list is exhaustive — re-check it.
- `--dir` scopes the run into the target repo/worktree (pass the pinned-SHA worktree path from `DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md`, not the canonical directory, for parallel dispatches).
- The **content** of the dispatch brief doesn't change — same research step, acceptance criteria, self-vetting, delivery-report format as the template below. Only the transport changes: `Bash` → `opencode run`, never `Agent`.
- Claude's job after dispatch: read the DeepSeek run's output/delivery report, review the diff, verify checks, then merge — never re-implement what DeepSeek already did.
- The `Agent` tool is reserved for: research/investigation needing frontier judgment, reviewing DeepSeek's output, and safety-critical decisions (security fixes, destructive git operations, architecture calls). It is not a substitute for DeepSeek dispatch under any framing.

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

Invoke via:
```bash
opencode run --model opencode-go/deepseek-v4-flash --dir <worktree_path> "$(cat <<'BRIEF'
[the full brief below, filled in]
BRIEF
)"
```

```
You are implementing [specific task] for GlasApp refactoring Phase N.

CONTEXT:
- Repository: /Users/sammcdonnell/Documents/GlasApp
- Worktree: create your own isolated worktree — do NOT work in the canonical
  directory (see DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md §2 for the exact
  commands). Base: [pinned exact commit SHA, not a branch name]
- Branch: feature/phase-N-task-M (created from the pinned SHA above)
- Tech stack: React 18, Express, TypeScript, Drizzle ORM, Supabase

STEP 0 — RESEARCH CURRENT BEST PRACTICES (mandatory, before writing any code):
Before implementing, do an actual web search — do not rely on training-data
memory, which goes stale. Concretely:
- Search for a popular, actively-maintained open-source project or library
  that already solves the same problem well (e.g. on GitHub — check stars,
  recent commit activity, open issue health) and use it as a reference for
  the shape of a good solution, even if you don't adopt it as a dependency.
- Search Anthropic's engineering blog (anthropic.com/engineering or
  anthropic.com/research) and any other primary-source engineering blog
  relevant to the task (e.g. the framework's own blog) for current guidance
  on structuring this kind of change — testing approach, error handling,
  security posture, code organization.
- Check the installed version of the relevant library/framework in
  package.json and look up that version's own docs/changelog — do not assume
  an older or newer API than what's actually installed.
- If the task involves auth, data handling, SQL, or anything security-
  sensitive, search for current (this year's) known vulnerabilities/advisories
  for the libraries involved.
- If the task involves a pattern this codebase already uses elsewhere
  (Drizzle queries, React component structure, etc.), current best practice
  is usually "match the existing pattern" — don't introduce a newer library
  idiom that the rest of the codebase doesn't use, unless the task explicitly
  asks you to modernize that pattern.
- Report what you searched and what you found in your delivery report's
  "Research" section (see TEAM_DELIVERY_REPORT.md) — cite the actual URLs/
  repos/docs you looked at, not just "I know this."

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

SELF-VETTING (mandatory, before writing your delivery report):
Before declaring COMPLETE, review your own diff as if you were a skeptical
reviewer seeing it cold:
- Re-read every changed line against the acceptance criteria — does it
  actually satisfy them, or does it just look plausible?
- Check for the failure modes that caused problems in past dispatches:
  did you verify usage/callers by grep rather than assuming from a name?
  did you avoid inventing schema/abstractions not asked for? did you keep
  changes inside the declared file scope?
- Run every check listed in TESTING above and in ACCEPTANCE CRITERIA
  yourself — do not report PASS on a check you didn't actually run.
- Note any assumption you weren't 100% sure of as a flagged risk in your
  report rather than silently shipping it.

COMMIT MESSAGE:
[Provide exact commit message to use; ensure it references the task]

DO NOT:
- Make changes outside the listed files
- Add adjacent refactoring
- Modify git history (create new commits only)
- Work in the canonical repo directory instead of your worktree

DONE WHEN:
- Research step completed and documented
- All files modified as specified
- TypeScript check passes (npm run check)
- Self-vetting pass completed and documented
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
