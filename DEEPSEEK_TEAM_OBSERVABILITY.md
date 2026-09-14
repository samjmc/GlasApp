# DeepSeek Team Observability — Spec for Team to Build

**Assigned to:** DeepSeek Observability Team  
**Purpose:** Build observability infrastructure so we can see what DeepSeek teams are doing, where they get stuck, and how to improve the system.  
**Timeline:** Complete before Phase 2 dispatch (prerequisite infrastructure task)  
**Outcome:** A system that automatically tracks team performance, blockers, and quality signals.

---

## Problem

When DeepSeek teams execute Phase 2-4 implementation tasks:
- We (Claude) can only see the final commit
- We don't know how long they worked, where they struggled, what they tried
- We can't diagnose "why did this take 2× estimate?"
- We can't optimize the dispatch model without data

**Solution:** DeepSeek teams instrument their own work so we have visibility.

---

## What to Build

### 1. Structured Logging (Per Team)

Each team should log their work in a structured format:

**File:** `TEAM_DISPATCH_LOG_[TEAM_NAME].jsonl`  
**Format:** One JSON object per line (JSONL), each representing a discrete action

```json
{
  "timestamp": "2026-09-14T14:30:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "started_task",
  "event": "Task 2A (component consolidation) started"
}
{
  "timestamp": "2026-09-14T14:35:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "file_modified",
  "file": "client/src/components/OfficialElectoralMap.tsx",
  "lines_added": 45,
  "lines_removed": 12,
  "reason": "Consolidating map component logic; removing MapboxIrelandMap duplicate"
}
{
  "timestamp": "2026-09-14T14:50:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "blocker_encountered",
  "blocker_type": "type_error",
  "description": "LeafletIrelandMap exports type MapboxProps which doesn't exist",
  "resolution": "Searched codebase; found prop type defined in IrelandMap.tsx instead",
  "time_to_resolve_minutes": 5
}
{
  "timestamp": "2026-09-14T15:00:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "quality_check",
  "check_type": "typescript",
  "status": "pass",
  "errors": 0,
  "warnings": 0
}
{
  "timestamp": "2026-09-14T15:05:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "ready_for_review",
  "files_modified": 5,
  "commits_created": 2,
  "notes": "Component consolidation complete; all imports updated; TypeScript check passes"
}
```

**Standard Actions:** `started_task`, `file_modified`, `blocker_encountered`, `quality_check`, `dependency_resolved`, `ready_for_review`, `task_complete`

### 2. Blocker Tracking

When a team hits a blocker, log it with:
- **Type:** `type_error`, `import_error`, `logic_error`, `missing_context`, `unclear_spec`, `other`
- **Severity:** `critical` (blocks), `major` (slows down), `minor` (workaround exists)
- **Time to resolve:** How long it took to get unstuck
- **Resolution method:** What helped (searched codebase, asked Claude, found workaround, spec clarification)

Example:
```json
{
  "timestamp": "2026-09-14T14:50:00Z",
  "team": "ComponentConsolidationTeam",
  "action": "blocker_encountered",
  "blocker_type": "unclear_spec",
  "description": "Task says 'consolidate maps' but 6 different maps have different props. Which becomes canonical?",
  "severity": "major",
  "time_to_resolve_minutes": 15,
  "resolution": "Chose OfficialElectoralMap as canonical based on it being most feature-complete; merged other props into it"
}
```

### 3. Quality Gate Results

Before marking task done, run and log:

```json
{
  "timestamp": "2026-09-14T15:00:00Z",
  "team": "ComponentConsolidationTeam",
  "action": "quality_check",
  "check_type": "typescript",
  "status": "pass",
  "output": "0 errors, 0 warnings"
}
{
  "timestamp": "2026-09-14T15:01:00Z",
  "team": "ComponentConsolidationTeam",
  "action": "quality_check",
  "check_type": "imports",
  "status": "pass",
  "updated_imports": 24,
  "missing_imports": 0
}
{
  "timestamp": "2026-09-14T15:02:00Z",
  "team": "ComponentConsolidationTeam",
  "action": "quality_check",
  "check_type": "commit_structure",
  "status": "pass",
  "commits": 2,
  "commit_messages_reviewed": true,
  "notes": "Commits are focused; each has clear scope"
}
```

### 4. Effort Tracking

Log time spent on different activities:

```json
{
  "timestamp": "2026-09-14T16:00:00Z",
  "team": "ComponentConsolidationTeam",
  "task_id": "2A",
  "action": "effort_summary",
  "total_time_minutes": 90,
  "breakdown": {
    "understanding_spec": 10,
    "implementation": 55,
    "debugging_blockers": 15,
    "quality_checks": 5,
    "documentation": 5
  },
  "estimate_vs_actual": {
    "estimate_minutes": 240,
    "actual_minutes": 90,
    "variance_percent": -62.5
  }
}
```

### 5. Handoff Document (Per Task)

When task is complete, write `TASK_2A_HANDOFF.md`:

```markdown
# Task 2A Handoff — Component Consolidation

**Team:** ComponentConsolidationTeam  
**Status:** READY FOR REVIEW  
**Time Spent:** 90 minutes (estimate: 240 minutes, 62% faster)

## What We Did
- Consolidated 13 map components into OfficialElectoralMap.tsx
- Merged 6 results components into polymorphic EnhancedResults.tsx
- Consolidated 3 quiz contexts into single QuizContext.tsx
- Updated 45 import statements across codebase

## Files Modified
- client/src/components/OfficialElectoralMap.tsx (consolidated, +120 lines)
- client/src/components/EnhancedResults.tsx (created, +200 lines)
- client/src/contexts/QuizContext.tsx (consolidated, +50 lines)
- [24 page/component files updated with new imports]

## Quality Checks
- TypeScript: ✓ PASS (0 errors)
- Imports: ✓ ALL RESOLVED (no missing imports)
- Commits: ✓ FOCUSED (2 commits, clear messages)

## Blockers Encountered & Resolved
1. **Type collision** (LeafletIrelandMap.MapboxProps undefined)
   - Resolution: Found prop type in IrelandMap.tsx, updated references
   - Time: 5 minutes

2. **Unclear which map component is canonical**
   - Resolution: Chose OfficialElectoralMap based on feature completeness
   - Time: 15 minutes

## What Went Well
- Component patterns were consistent; consolidation was straightforward
- Clear code structure made finding imports easy
- TypeScript caught potential issues during refactoring

## What Was Tricky
- 13 map components had overlapping but slightly different APIs
- Some pages imported maps via different paths (relative vs absolute)
- Quiz context had state spread across 3 files; required careful merge

## Ready for Review?
✓ YES — All acceptance criteria met, all checks pass, ready for Claude review + merge

## Commits Created
1. `refactor: consolidate 13 map components → OfficialElectoralMap`
2. `refactor: merge 6 results components + consolidate quiz contexts`
```

### 6. Automated Dashboard (Summary)

Generate a simple JSON summary that Claude can consume:

**File:** `TEAM_DISPATCH_SUMMARY.json`

```json
{
  "execution_date": "2026-09-14",
  "phases_completed": [
    {
      "phase": "Phase 2",
      "tasks": [
        {
          "task_id": "2A",
          "team": "ComponentConsolidationTeam",
          "status": "complete",
          "estimate_minutes": 240,
          "actual_minutes": 90,
          "blockers_encountered": 2,
          "blockers_resolved": 2,
          "quality_checks_passed": 3,
          "quality_checks_failed": 0,
          "files_modified": 27,
          "commits_created": 2
        },
        {
          "task_id": "2B",
          "team": "DatabaseSchemaTeam",
          "status": "complete",
          "estimate_minutes": 180,
          "actual_minutes": 165,
          "blockers_encountered": 1,
          "blockers_resolved": 1,
          "quality_checks_passed": 4,
          "quality_checks_failed": 0,
          "files_modified": 3,
          "commits_created": 3
        }
      ]
    }
  ],
  "aggregate_metrics": {
    "total_teams": 3,
    "total_tasks": 3,
    "all_complete": true,
    "total_estimate_minutes": 660,
    "total_actual_minutes": 555,
    "velocity": "+19% faster than estimate",
    "blockers_total": 5,
    "blockers_resolved": 5,
    "quality_gates_passed": 10,
    "quality_gates_failed": 0
  }
}
```

---

## Acceptance Criteria for This Observability System

- [ ] JSONL logging format works (each action is discrete, timestamped, easy to parse)
- [ ] Blocker tracking captures the types of issues teams encounter (helps optimize specs)
- [ ] Quality checks (TypeScript, imports, commit structure) pass before marking task done
- [ ] Handoff document is clear enough for Claude to review without asking questions
- [ ] Summary JSON can be parsed and used to measure team velocity, identify patterns
- [ ] Logging doesn't slow down team work (minimal overhead)

---

## How Claude Will Use This

After each DeepSeek team completes work:

1. **Read TASK_[N]_HANDOFF.md** → Understand what was done, blockers encountered
2. **Parse TEAM_DISPATCH_LOG_[NAME].jsonl** → See timeline of work, where time was spent
3. **Check TEAM_DISPATCH_SUMMARY.json** → See velocity, patterns across teams
4. **Review for gaps:**
   - Did team log blockers? (Yes = good self-awareness; No = flag for future)
   - Quality checks pass? (Yes = merge; No = send back for fixes)
   - Time vs. estimate reasonable? (helps calibrate future estimates)

---

## Outcome

After Phase 2 runs with full observability:

- Claude knows: What each team did, how long, where they got stuck, what worked
- Next phases (3 & 4) can use this data to:
  - Refine task specs (if blocker types recur, spec was unclear)
  - Rebalance team sizes (if tasks consistently run 30% over, add people)
  - Identify infrastructure gaps (common blockers = missing utilities)
  - Improve dispatch model itself (spot patterns in what helps teams unstuck)

This transforms "we deployed teams and got code back" into "we understand how our teams work and can optimize the system."

---

## Important

**Do not make observability optional or "best effort."**  
**Do not log after the fact; log in real-time as work happens.**  
**The logs ARE the deliverable, not a side effect.**

Team performance improvement happens when we can see what's actually happening.
