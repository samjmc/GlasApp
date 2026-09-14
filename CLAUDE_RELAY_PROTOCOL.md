# Claude Relay Protocol — How I Process & Relay Team Reports

**This is what I do when I receive a TEAM_DELIVERY_REPORT from DeepSeek:**

---

## 1. Receive Report from Team

DeepSeek team completes Task N.M and delivers TEAM_DELIVERY_REPORT.md with:
- What they built
- What they implemented  
- Quality checks (pass/fail)
- Blockers (if any)
- Did they spawn sub-sessions? If yes, why?
- Next steps
- Observability data (time, metrics, effort breakdown)

---

## 2. Quick Validation (Claude Does This)

I spend **5-15 minutes** on:

- [ ] Read the report end-to-end
- [ ] Check TypeScript compilation passes
- [ ] Verify commits are focused and have good messages
- [ ] Check if any quality gates failed (if so, flag for rework)
- [ ] Verify all acceptance criteria are met (from REFACTORING_ROADMAP.md)

**Decision Point:**
- ✅ All checks pass → Approve, relay to user, merge code
- ⚠️ Minor issues → Request quick fixes from team, re-validate
- ❌ Major issues → Send back to team with specific feedback

---

## 3. Relay to User

I give you **exactly what the team reported**, formatted as:

```
## [Phase N, Task M] — [Task Name]

**Status:** COMPLETE  
**Time Spent:** X hours (Estimate: Y, Variance: +Z%)

### What They Built
[Team's summary of deliverables]

### Quality Checks
[Team's results: TypeScript ✓, Tests ✓, Imports ✓, etc.]

### Blockers & Resolutions
[Team's blockers (if any) + how they solved them]

### Did They Spawn Sub-Sessions?
[Team's answer — if yes, what for and why]

### Next Steps
[Team's recommendation for what's next]

### Observability Data
- Timeline: Started X, ended Y (duration: Z)
- Effort: Implementation 60%, debugging 25%, checks 15%
- Metrics: 12 files modified, 450 lines added, 3 commits
- Blockers encountered/resolved: 2/2

### Claude's Validation
- Code review: ✓ PASS
- All acceptance criteria met: ✓ YES
- Ready to merge: ✓ YES
```

---

## 4. Track Progress

I update **OBSERVABILITY_LOG.md** with:
- Task completion time (actual vs estimate)
- Blockers encountered + resolution time (patterns emerge)
- Quality metrics (did they pass checks?)
- Did they spawn sessions? (indicates task decomposition)
- Confidence level (high/medium/low from their report)

---

## 5. Identify Patterns (Continuous Improvement)

After each phase completes, I look for:

**Patterns in blockers:**
- Same type recurring? (e.g., "unclear spec on X") → Improve spec for next phase
- Blockers taking too long? (e.g., TypeScript errors) → Provide utilities/templates

**Patterns in time spent:**
- Estimate consistently wrong? (e.g., always 30% over) → Recalibrate estimates
- Some tasks always faster? → Maybe they're overspecified

**Patterns in sub-sessions:**
- Teams spawning sessions to handle dependencies? → Maybe task order is wrong
- Teams spawning sessions for infrastructure? → Build that infrastructure centrally

**Patterns in quality:**
- TypeScript failures common? → Provide better types upfront
- Import issues recur? → Centralize path utilities

---

## 6. Zero Extra Work for You

You receive:
- One clean report per task
- Shows what was built, how it went, what's next
- Shows what went well and what was hard
- Shows if they needed to spawn sub-teams and why
- Shows timing and effort breakdown

**You don't see:**
- Git diffs (I validate them)
- Technical implementation details (team reported it; you don't need raw code)
- My validation process (just the outcome: ✓ PASS or ⚠️ needs fixes)

---

## Example Flow

### Task 2A: Component Consolidation

**Team delivers report:**
```
Status: COMPLETE
Time: 90 min (estimate: 240, 62% faster)
Built: Consolidated 13 maps into 1, merged 6 results components, merged 3 quiz contexts
Quality: TypeScript ✓, Imports ✓, Commits ✓
Blockers: 2 encountered, 2 resolved (type collision: 5 min, unclear spec: 15 min)
Sub-sessions: No — task was self-contained
Next: Ready for Claude review and merge
Confidence: HIGH
```

**I relay to you:**
```
✓ Task 2A COMPLETE (90 min, 62% faster than estimate)

Team consolidated:
- 13 map components → 1 (OfficialElectoralMap)
- 6 results components → 1 polymorphic component
- 3 quiz contexts → 1 unified context

Blockers: 2 hit, both resolved quickly
- Type collision in component props: 5 min fix
- Unclear spec on which map is canonical: 15 min resolution

Quality: All checks pass (TypeScript, imports, commit structure)

Confidence: HIGH

Status: Ready to merge. Next: Gate run validation.
```

**You decide:** OK, merge it. What's next?

---

## I Don't Do

- Write implementation code (team does)
- Build observability tooling (team does)
- Write detailed commit messages (team does, I validate them)
- Debug code issues (team debugs, I check if resolved)
- Make architectural decisions (I proposed roadmap, team follows it, I validate)

---

## I Do Do

- Receive clean reports
- Validate they meet spec
- Relay key info to you
- Track patterns for improvement
- Coordinate what's next
- Run gates
- Update roadmap if blockers suggest changes

---

## Result

You get:

✅ Clear visibility into what each team did  
✅ Timing and effort data for each task  
✅ Blocker patterns that suggest spec improvements  
✅ Sub-session spawning that shows task decomposition  
✅ One clean summary per task, not noisy raw logs  
✅ Continuous improvement as patterns emerge  

And I'm 80% out of the work, just coordinating and relaying.
