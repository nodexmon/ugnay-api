Run this checklist before opening or marking a PR ready for review.

## Pre-PR checklist

1. **Lint:** `pnpm lint` — fix all errors and warnings. No ESLint suppressions unless justified.
2. **Tests:** `pnpm test` — all must pass. Do not suppress or skip failing tests.
3. **Build:** `pnpm build` — must compile cleanly with no TypeScript errors.
4. **Spot-check the diff:**
   - No `console.log` left in source files.
   - No `any` types introduced.
   - No commented-out code.
   - No `.only` or `.skip` on test blocks.
   - No hardcoded secrets, URLs, or env-specific values outside config factories.
5. **Dev log:** Confirm `logs/dev.log` has an entry for this session's work.
6. **Handout:** If any endpoint was added, removed, or changed — update `docs/UGNAY_API_HANDOUT.md`.

## PR title format

`<type>(<scope>): <summary>` — conventional-commit style, matching the branch's commits.
Example: `feat(bookings): expire stale bookings via cron`.

## PR description format

```
## What
<one paragraph: what changed and why>

## How
<bullet list of the key implementation decisions — not a file-by-file walkthrough>

## Testing
<how this was verified: unit tests, manual curl, seed data, etc.>
```

## Rules

- One PR = one concern. Don't bundle a feature with an unrelated refactor.
- Base branch is `main` unless told otherwise.
- If the PR touches auth, permissions (CASL), or booking lifecycle — call it out explicitly in the description.
- Never force-push a branch after sharing it for review.
