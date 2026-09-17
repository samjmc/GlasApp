# Coding Discipline

## 1. Minimum Viable Code

- No features beyond what was asked
- No abstractions for single-use code
- No error handling for impossible scenarios
- No speculative "what if we need to..." flexibility

If you write 200 lines and it could be 50, rewrite it.

## 2. Surgical Changes Only

When editing:
- Don't "improve" adjacent code
- Don't refactor things that aren't broken
- Match existing style
- If you notice unrelated issues, mention them — don't fix them

**The test**: every changed line traces directly to the user's request.

## 3. Verify Before Done

Don't mark a task complete without proving it works:
- Run the code, check the output
- Test edge cases
- If you can't verify, say what to check and why

A check that examined nothing is not a passing check.

## 4. Remove Only What You Made Unused

When your changes orphan an import/variable/function, remove it. Don't remove pre-existing dead code unless asked.

## 5. Comments

Default: no comments. Add one only when the *why* is non-obvious — a hidden constraint, a workaround, surprising behavior. Don't describe what the code does (good names do that).

## 6. Two TypeScript Traps

- Never use the regex `s` (dotAll) flag — ES2017 target. Use `[\s\S]` instead
- Never validate caller input with `obj[key] === undefined` — use `Object.prototype.hasOwnProperty.call(allowed, key)`
