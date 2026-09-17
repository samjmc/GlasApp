# Project Context

## Overview

This project uses Claude Code with a structured workflow:
- **Plan first**: specs, decisions, architecture trade-offs before coding
- **Implement**: surgical changes, verify as you go
- **Review & iterate**: catch bugs, slop, and loose ends before shipping

## Workflow

1. **Session start** — freshen checkout, validate memory
2. **Plan** — write the spec/architecture before coding
3. **Implement** — follow the discipline rules
4. **Verify** — run tests, check the UI/output, don't claim success without proof
5. **Review** — catch bugs, simplify, fix findings before merge
6. **Closeout** — confirm work is safe to ship, update memory

## Core Skills

Invoke these when relevant:

| Skill | When |
|-------|------|
| `session-start` | Before non-trivial work |
| `vet` | Before writing code on a spec/plan |
| `code-review` | Before merging (catch bugs, slop) |
| `review-loop` | For autonomous multi-pass review |
| `precompact` | Before context compression |
| `session-closeout` | Before closing the chat |

## Rules

Read these:
- `.claude/rules/planning-discipline.md` — why you plan first
- `.claude/rules/coding-discipline.md` — how to write minimal, correct code
- `.claude/rules/git-discipline.md` — commits, branches, safety

## Memory

Personal knowledge lives in `.claude/projects/<name>/memory/` — learnings, preferences, proven patterns for this project and similar ones.

## No Magic

This is just structure. The work is still yours to direct — Claude is here to accelerate, not replace your judgment.
