# Skills

These are playbooks for specific tasks. Invoke them when relevant:

## Workflow

- `session-start` — Before non-trivial work. Freshens checkout, validates memory.
- `session-closeout` — Before ending the chat. Confirms work is safe, captures learnings.

## Planning & Design

- `vet` — Adversarially review a plan/spec/design before coding. Catches gaps, trade-offs, second-order effects.

## Implementation & Review

- `code-review` — Review changed code for bugs and slop. Supports inline fixes.
- `review-loop` — Autonomous multi-pass review: security, logic, bloat, AI-slop. Fixes findings, re-checks.

## Context Management

- `precompact` — Before context compression. Triage what's worth keeping into memory vs. what's ephemeral.

## Superpowers

- `superpowers:writing-plans` — Structure multi-step implementation plans
- `superpowers:test-driven-development` — Write tests before implementation
- `superpowers:systematic-debugging` — Debug a failure methodically
- `superpowers:verification-before-completion` — Run checks before claiming done
- `superpowers:receiving-code-review` — Process review feedback carefully

Invoke with `/skill-name` or just name the skill in a prompt.
