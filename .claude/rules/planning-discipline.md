# Planning Discipline

Write the plan *before* the code. Every time.

## Why

- **Clarity**: writing forces you to name ambiguities, trade-offs, and unknowns
- **Speed**: a five-minute written spec beats an hour of mid-code course-correction
- **Confidence**: you can run the plan by others, iterate on it, *then* commit to implementation

## How

Before touching code:

1. **State the goal** (one sentence — what does "done" look like?)
2. **List assumptions** (if uncertain, ask first)
3. **Name trade-offs** (speed vs correctness, simplicity vs flexibility, etc.)
4. **Break into steps** (each step has a verification condition)
5. **Flag blockers** (what could go wrong? what's not in scope?)

For multi-step work, use the `/plan` skill or write it inline. Either way, get it written before starting.

## What Not To Do

- Don't write a plan and then ignore it mid-implementation
- Don't plan in your head — write it down so you can refer back and iterate
- Don't plan for hypothetical futures ("what if we need to scale to 10x?") — plan for what you're building now
