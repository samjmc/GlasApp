# Implementation Dispatch Template

**Use this template to dispatch each new priority/implementation work.**

Copy the JSON block below and append it to `metrics/implementation-velocity.json` under `in_flight_implementations` array.

---

## Template (Copy & Fill)

```json
{
  "priority": "X",
  "phase": "Y",
  "name": "Work name here",
  "description": "What problem does this solve? What's being built?",
  "work_type": "type-safety|query-optimization|middleware-extraction|route-consolidation|algorithm-enhancement|feature-addition|schema-migration|legacy-removal",
  
  "dispatched_by": "dispatcher-name",
  "dispatched_at": "2026-09-10T14:00:00Z",
  
  "assigned_team": "team-name (optional)",
  "assigned_to": ["person1", "person2"],
  
  "linked_resources": {
    "issue_id": "#42",
    "pr_branch": "priority-X-short-name",
    "discussion_link": "https://github.com/...",
    "related_doc": "docs/PHASE_1_FOUNDATION_IMPLEMENTATION.md"
  },
  
  "estimated_scope": {
    "files_to_modify": 0,
    "estimated_lines_of_change": 0,
    "estimated_loc_added": 0,
    "estimated_loc_removed": 0,
    "complexity_rating": 0,
    "complexity_factors": [
      "factor 1",
      "factor 2"
    ]
  },
  
  "velocity_baseline": {
    "work_type_baseline": "X hours/unit",
    "base_hours": 0,
    "complexity_multiplier": 1.0,
    "estimated_hours": 0,
    "confidence_interval_low": 0,
    "confidence_interval_high": 0,
    "notes": "How was estimate derived?"
  },
  
  "prerequisites": [
    "Completed: Priority X",
    "Merged: PR #YYY"
  ],
  
  "success_criteria": [
    "Criterion 1",
    "Criterion 2",
    "Tests passing",
    "Code reviewed"
  ],
  
  "risks": [
    "High-risk: Impacts auth system",
    "Medium-risk: Performance regression possible"
  ],
  
  "status": "dispatched"
}
```

---

## Filled Example (Priority 6 - TD Scoring Pipeline)

```json
{
  "priority": "6",
  "phase": "2",
  "name": "TD Scoring Pipeline Algorithm",
  "description": "Enhance TD scoring algorithm to incorporate debate participation quality (not just vote alignment). Implement weighted scoring based on debate frequency, position evolution, and cross-party collaboration.",
  "work_type": "algorithm-enhancement",
  
  "dispatched_by": "sam",
  "dispatched_at": "2026-09-11T10:00:00Z",
  
  "assigned_team": "backend-team-1",
  "assigned_to": ["developer-1"],
  
  "linked_resources": {
    "issue_id": "#87",
    "pr_branch": "priority-6-td-scoring-algorithm",
    "discussion_link": "https://github.com/samjmc/GlasApp/discussions/42",
    "related_doc": "server/services/comprehensiveTDScoringService.ts"
  },
  
  "estimated_scope": {
    "files_to_modify": 12,
    "estimated_lines_of_change": 2000,
    "estimated_loc_added": 1500,
    "estimated_loc_removed": 300,
    "complexity_rating": 7,
    "complexity_factors": [
      "Algorithm complexity: need to weight multiple signals",
      "Debate data dependency: need to parse debate transcripts",
      "Backwards compatibility: must not break existing scoring",
      "Test coverage required: scoring changes must not regress TD rankings"
    ]
  },
  
  "velocity_baseline": {
    "work_type_baseline": "Algorithm enhancement: 500-800 LOC/hour",
    "base_hours": 12,
    "complexity_multiplier": 1.5,
    "estimated_hours": 18,
    "confidence_interval_low": 14.4,
    "confidence_interval_high": 21.6,
    "notes": "Similar to Priority 2 Phase 1 foundation work (1.5x for algorithm complexity). Base estimate: 12 files @ 1 hour per file. Multiplier for high complexity and test coverage (algorithm changes must be deeply tested)."
  },
  
  "prerequisites": [
    "Completed: Priority 1 (type-safety)",
    "Completed: Priority 2 Phase 1 (foundation)",
    "Completed: Priority 8 (query optimization)"
  ],
  
  "success_criteria": [
    "Algorithm implementation: 1,500 LOC added",
    "Tests added: debate scoring unit tests pass",
    "Backwards compatible: existing TDs still have valid scores",
    "Regression test: rankings unchanged for existing 100 TDs",
    "Code reviewed: at least one domain expert review"
  ],
  
  "risks": [
    "High-risk: Scoring changes could downrank top TDs unexpectedly",
    "Medium-risk: Debate parsing might have edge cases",
    "Low-risk: Type-safe implementation (TypeScript catches errors)"
  ],
  
  "status": "dispatched"
}
```

---

## How to Use

### Step 1: Dispatcher Fills Template
- Set priority, phase, name, description
- Estimate scope (files, LOC, complexity)
- Calculate estimated hours using velocity baseline
- Add prerequisites and success criteria

### Step 2: Append to Metrics File
```bash
# Add to metrics/implementation-velocity.json under "in_flight_implementations"
# Commit:
git add metrics/implementation-velocity.json
git commit -m "metrics: dispatch priority X"
```

### Step 3: Share with Team
- Link to dispatch record
- Review velocity baseline and confidence interval
- Discuss risks and success criteria
- Begin work

### Step 4: Team Creates Branch
```bash
git checkout -b priority-X-short-name
# Work on implementation
```

---

## Tips

**Estimating files to modify:**
- Type-safety work: 50-100+ files (scattered changes)
- Query optimization: 1-5 files (concentrated changes)
- Middleware extraction: 5-15 files (code + tests + docs)
- Route consolidation: 10-40 files (multiple routes)
- Algorithm enhancement: 8-15 files (core logic + tests)

**Estimating complexity:**
- 1-3: Trivial (e.g., rename variable, add comment)
- 4-6: Moderate (e.g., new feature, refactor, query fix)
- 7-10: Complex (e.g., new algorithm, breaking changes, multi-system impact)

**Setting success criteria:**
- Must include: Tests passing, code reviewed
- Should include: Backwards compatible, no regressions
- Consider: Documentation, security, performance

---

**Questions? See MEASUREMENT_SYSTEM.md for details.**
