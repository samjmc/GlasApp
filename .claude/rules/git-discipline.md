# Git Discipline

## Commits

- Write clear commit messages (what changed, why)
- One logical change per commit (not one file per commit, not one feature squashed into one)
- No force-push unless truly necessary (and you know what you're doing)
- Review staged changes before committing (`git diff --staged`)

## Branches

- Branch off `main` (or `develop` if that's your default)
- Use short, descriptive names: `fix/bug-name` or `feat/feature-name`
- Delete branches after merging
- Never commit directly to `main` — always via PR/review

## Safety Checks

Before `git push`:
- `git status` — nothing unexpected staged?
- `git log -1` — does the message make sense?
- On destructive operations (reset --hard, rebase -i, force-push), pause first

## Pull Requests

- Write a clear title and description
- Link related issues
- Don't merge your own PR without review (when working with others)
- Squash or rebase if the branch is messy, but prefer clean history

## What NOT To Do

- Don't skip hooks with `--no-verify`
- Don't force-push to shared branches
- Don't commit secrets, API keys, or credentials
- Don't commit large binaries or node_modules
