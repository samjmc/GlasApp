# Implementation Completion Template

**Use this template to record metrics when work is completed.**

Copy the JSON block below and append it to `metrics/implementation-velocity.json` under `completed_implementations` array, and remove the corresponding entry from `in_flight_implementations`.

---

## Template (Copy & Fill)

```json
{
  "priority": "X",
  "phase": "Y",
  "name": "Work name",
  "work_type": "type-safety|query-optimization|middleware-extraction|route-consolidation|...",
  
  "completed_by": "developer-name",
  "completed_at": "2026-09-11T16:30:00Z",
  
  "commits": [
    {
      "hash": "abc123def456",
      "timestamp": "2026-09-11T14:15:00Z",
      "message": "implement TD scoring algorithm",
      "files_modified": 6,
      "lines_added": 500,
      "lines_removed": 100
    },
    {
      "hash": "ghi789jkl012",
      "timestamp": "2026-09-11T16:30:00Z",
      "message": "add comprehensive tests for TD scoring",
      "files_modified": 3,
      "lines_added": 400,
      "lines_removed": 0
    }
  ],
  
  "total_files_modified": 9,
  "total_lines_added": 900,
  "total_lines_removed": 100,
  "net_loc_change": 800,
  
  "start_timestamp": "2026-09-11T14:15:00Z",
  "end_timestamp": "2026-09-11T16:30:00Z",
  "elapsed_hours": 2.25,
  
  "complexity_rating": 7,
  "complexity_factors": [
    "Algorithm was more complex than expected",
    "Edge cases in debate parsing took longer"
  ],
  
  "velocity_metrics": {
    "files_per_hour": 4.0,
    "loc_added_per_hour": 400.0,
    "loc_removed_per_hour": 44.4
  },
  
  "deviations": {
    "hours_estimated": 18.0,
    "hours_actual": 2.25,
    "percent_error": "-87.5%",
    "reason": "This completion entry is for first commit only (algorithm core). Phase 2 (tests + integration) continues. Partial completion logged.",
    "variance_factors": [
      "Scope was smaller than full estimate",
      "Algorithm design was more straightforward than anticipated"
    ]
  },
  
  "quality_gates": {
    "tests_added": true,
    "tests_passing": true,
    "code_review_completed": true,
    "code_review_approved": true,
    "security_review_completed": false,
    "performance_tested": true,
    "performance_regression": false
  },
  
  "review_notes": {
    "reviewer": "reviewer-name",
    "review_url": "https://github.com/samjmc/GlasApp/pull/123#pullrequestreview-XXX",
    "concerns": [],
    "suggestions": [
      "Consider caching debate participation scores"
    ]
  },
  
  "metrics_feedback": {
    "velocity_baseline_updated": false,
    "learned": [
      "Debate parsing is not the bottleneck (algorithm design is)",
      "Test coverage for algorithm can be 50% (vs 100% estimated)"
    ],
    "next_priority_adjustment": "If Priority 7 (Quiz Improvements) has similar algorithm complexity, reduce estimate by 30%"
  },
  
  "status": "completed"
}
```

---

## Filled Example (Priority 6 Partial Completion)

```json
{
  "priority": "6",
  "phase": "2",
  "name": "TD Scoring Pipeline Algorithm",
  "work_type": "algorithm-enhancement",
  
  "completed_by": "developer-1",
  "completed_at": "2026-09-11T16:30:00Z",
  
  "commits": [
    {
      "hash": "a1b2c3d4e5f6",
      "timestamp": "2026-09-11T14:15:00Z",
      "message": "implement TD scoring algorithm with debate quality weighting",
      "files_modified": 6,
      "lines_added": 580,
      "lines_removed": 120
    },
    {
      "hash": "g7h8i9j0k1l2",
      "timestamp": "2026-09-11T15:45:00Z",
      "message": "add unit tests for debate scoring calculations",
      "files_modified": 3,
      "lines_added": 420,
      "lines_removed": 0
    }
  ],
  
  "total_files_modified": 9,
  "total_lines_added": 1000,
  "total_lines_removed": 120,
  "net_loc_change": 880,
  
  "start_timestamp": "2026-09-11T14:15:00Z",
  "end_timestamp": "2026-09-11T15:45:00Z",
  "elapsed_hours": 1.5,
  
  "complexity_rating": 6,
  "complexity_factors": [
    "Algorithm was more straightforward than expected",
    "Debate quality calculation simplified due to existing participation data",
    "Edge cases handled elegantly through TypeScript types"
  ],
  
  "velocity_metrics": {
    "files_per_hour": 6.0,
    "loc_added_per_hour": 666.67,
    "loc_removed_per_hour": 80.0
  },
  
  "deviations": {
    "hours_estimated": 18.0,
    "hours_actual": 1.5,
    "percent_error": "-91.7%",
    "reason": "This represents Phase 1 of Priority 6 (algorithm + core tests only). Phase 2 (integration tests, debate parsing improvements) is separate continuation work. Estimate was for full Priority 6 scope.",
    "variance_factors": [
      "Algorithm complexity was 2 standard deviations below estimate",
      "Existing debate data format required minimal parsing changes",
      "No regressions found during testing (faster than expected)"
    ]
  },
  
  "quality_gates": {
    "tests_added": true,
    "tests_passing": true,
    "code_review_completed": true,
    "code_review_approved": true,
    "security_review_completed": false,
    "performance_tested": true,
    "performance_regression": false
  },
  
  "review_notes": {
    "reviewer": "senior-dev",
    "review_url": "https://github.com/samjmc/GlasApp/pull/156#pullrequestreview-789",
    "concerns": [],
    "suggestions": [
      "Consider adding caching for debate participation scores (currently O(N))",
      "Document the weighting formula in code comments for future maintainers"
    ]
  },
  
  "metrics_feedback": {
    "velocity_baseline_updated": true,
    "learned": [
      "Algorithm enhancement velocity is faster than estimated (likely because existing infrastructure handles debate data well)",
      "Test coverage for algorithm can be 60% (vs 100% estimated) and still catch most issues",
      "Complexity rating 6 is more accurate than estimated 7"
    ],
    "next_priority_adjustment": "For Priority 7 (Quiz Improvements, algorithm enhancement): reduce base estimate from 12 hours to 8-9 hours"
  },
  
  "status": "completed"
}
```

---

## How to Use

### Step 1: Extract Metrics from Git
```bash
# Get commit hash (latest on branch)
git log --oneline priority-6-td-scoring-algorithm | head -1

# Get all commits since dispatch
git log --oneline main..priority-6-td-scoring-algorithm

# Get detailed stats
git diff --stat main..priority-6-td-scoring-algorithm

# Get timestamps
git log -1 --format=%ai <commit-hash>
```

### Step 2: Fill Completion Record
- Extract commit data from git log
- Calculate elapsed time (last commit - first commit)
- Rate complexity post-hoc
- Document deviations from estimate

### Step 3: Run Quality Checks
```bash
# Verify tests pass
npm test

# Check code coverage
npm run coverage

# Lint code
npm run lint
```

### Step 4: Add to Metrics File
```bash
# Append completion record to metrics/implementation-velocity.json
# Remove corresponding entry from in_flight_implementations
# Commit:
git add metrics/implementation-velocity.json
git commit -m "metrics: complete priority 6 (algorithm implementation)"
```

### Step 5: Debrief with Team
- Share actual vs. estimated hours
- Discuss variance factors (why faster/slower?)
- Document learnings for future priorities
- Update velocity baseline if error > 25%

---

## Data Collection Checklist

### Commit Extraction
- [ ] All commits in PR identified
- [ ] Commit hashes correct
- [ ] Timestamps extracted (git log -1 --format=%ai)
- [ ] File counts accurate (git diff --name-only)
- [ ] LOC changes accurate (git diff --numstat)

### Timing Calculation
- [ ] Start timestamp = first commit timestamp
- [ ] End timestamp = last commit timestamp
- [ ] Elapsed hours = (end - start) in decimal hours
  - Example: 14:15 to 16:30 = 2.25 hours
  - Formula: minutes / 60, then sum

### Quality Assessment
- [ ] Complexity rated (1-10)
- [ ] Complexity factors documented
- [ ] Tests added? (yes/no)
- [ ] Tests passing? (yes/no)
- [ ] Code reviewed? (yes/no)
- [ ] Regressions found? (yes/no)

### Deviation Analysis
- [ ] Estimate vs actual compared
- [ ] Percent error calculated: ((actual - estimate) / estimate) * 100
- [ ] Reason for variance documented
- [ ] Velocity baseline updated if needed (error > 25%)

---

## Tips

**Extracting commit info quickly:**
```bash
# All at once
git log --format="| %h | %ai | %s | %an |" main..HEAD

# Count files and LOC
git diff --shortstat main..HEAD
```

**Calculating elapsed time:**
```bash
# Use online converter or bash
echo "scale=2; ($(date -d '2026-09-11T16:30:00Z' +%s) - $(date -d '2026-09-11T14:15:00Z' +%s)) / 3600" | bc
# Output: 2.25 hours
```

**Velocity per hour:**
```
files_per_hour = total_files / elapsed_hours
loc_per_hour = total_loc_added / elapsed_hours
```

**Identifying variance:**
- If actual < estimate by >25%: work was simpler than expected
- If actual > estimate by >25%: scope creep or underestimation
- If variance due to scope: document as "partial completion" and estimate remaining work

---

## When to Update Velocity Baseline

**Update if:**
- Work type's average error > 25% across last 3-5 implementations
- New complexity factors discovered that weren't in original model
- Team velocity shifts significantly (e.g., after hiring/turnover)

**How to update:**
1. Calculate average error for work type: `avg_error = mean(|actual - estimate| / estimate)`
2. If avg_error > 0.25 (25%), adjust baseline: `new_baseline = old_baseline * (1 + avg_error)`
3. Update velocity baselines table in MEASUREMENT_SYSTEM.md
4. Document reason for change in DEVIATION_LOG.md

**Example:**
```
Priority 6 actual: 1.5 hours, estimate: 18 hours → 91.7% error
This is an outlier (scope was split). Don't update baseline on single point.

After 5 algorithm enhancements:
  Priority 6: 1.5 hours (91.7% underestimate — scope split)
  Priority 7: 8 hours (estimate 12 hours)
  Priority 9: 9 hours (estimate 15 hours)
  Hypothetical: 7.5 hours (estimate 10 hours)
  Average error: (91.7 + 33 + 40 + 25) / 4 = 47.4%
  
This suggests algorithm complexity was overestimated.
New baseline: 12 * (1 - 0.474) = 6.3 hours for next algorithm work.
```

---

**Questions? See MEASUREMENT_SYSTEM.md for forecasting details.**
