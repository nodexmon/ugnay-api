Apply this process when diagnosing a failing test, runtime error, or unexpected behavior.

## Step 1 — Read the error precisely

- Copy the exact error message and stack trace before changing anything.
- Note which file and line it points to.
- For test failures: note whether it's a thrown exception, a wrong return value, or a mock assertion failure.

## Step 2 — Locate the failure

- For **test failures**: open the spec file, find the failing `it` block, and read the test setup (`beforeEach`, mock values, what the mock returns).
- For **runtime errors**: follow the stack trace to the source line. Read the surrounding context — 10 lines up and down.
- For **TypeScript errors**: read the full error including the expected vs actual type.

## Step 3 — Check the most common causes first

**Test failures:**
- Mock is returning the wrong shape — compare the mock's return value against what the code actually reads from it.
- `jest.clearAllMocks()` missing in `beforeEach` — stale state from a previous test.
- Missing mock method — the test provides `{ findUnique: jest.fn() }` but the code also calls `findFirst`.
- Assertions class not mocked — service test is using `PrismaService` directly instead of the assertions class.

**Runtime errors:**
- `process.env` accessed outside a config factory.
- Module not registered in `app.module.ts` or missing from `imports`.
- Prisma field name mismatch after a migration without regenerating the client.
- Guard or decorator missing on a controller route.

## Step 4 — Form a hypothesis and verify it

- State what you think is wrong before making any change.
- Make one targeted fix. Re-run only the failing file first: `pnpm jest src/path/to/file.spec.ts`
- If it still fails, re-read the error — do not spiral into multi-file changes.

## Step 5 — Confirm the fix

- Run the full test suite: `pnpm test`
- For runtime bugs: reproduce the original issue first, then confirm it's gone after the fix.
- If you cannot reproduce or isolate the issue after 3 focused attempts, stop and explain what you found to the user.
