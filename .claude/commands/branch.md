Before starting any work, create and checkout a meaningful branch.

## Rules
- Never work directly on `main`. Always branch first.
- Use the current `main` as the base unless told otherwise.
- Keep branch names lowercase, hyphen-separated, concise (3-5 words max).

## Naming convention
| Type | Prefix | Example |
|---|---|---|
| New feature | `feat/` | `feat/worker-availability` |
| Bug fix | `fix/` | `fix/otp-expiry-exception` |
| Refactor | `refactor/` | `refactor/bookings-service` |
| Database / schema | `db/` | `db/add-push-tokens` |
| Config / infra | `chore/` | `chore/throttler-setup` |

## Steps
1. Identify the type and subject of the work from the user's request.
2. Derive a short, descriptive branch name following the convention above.
3. Run: `git checkout -b <branch-name>`
4. Confirm the branch to the user, then proceed with the work.
