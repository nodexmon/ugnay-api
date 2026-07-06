Commit after every meaningful, self-contained unit of work. Do not batch unrelated changes into one commit.

## When to commit
- After completing a discrete feature or method (e.g. "add createBooking service method")
- After fixing a bug
- After a refactor that leaves tests passing
- After adding or fixing tests
- Never commit broken or half-finished code

## Commit message format
Use conventional commits:

```
<type>(<scope>): <short summary>

[optional body — only if the why isn't obvious]
```

| Type | When to use |
|---|---|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `test` | Adding or fixing tests |
| `chore` | Config, deps, tooling |
| `db` | Schema or migration changes |

## Rules
- Summary line: max 72 characters, imperative mood ("add", not "added" or "adds")
- Scope is optional but useful: the module or file affected (`bookings`, `auth`, `workers`)
- Do not add "also did X" at the end — that means two commits
- Always run `pnpm test` before committing. All tests must pass.

## Steps
1. Run `git status` to see what changed.
2. Stage only the files relevant to the current unit of work.
3. Run `pnpm test` — fix failures before committing.
4. Write the commit message following the format above.
5. Commit. Report the commit hash and message to the user.
