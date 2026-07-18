When asked to refactor a module or file, apply all of the following. Do not just flag issues — fix them.

## Step 1: Read before touching
- Read the full file(s) before making any changes.
- Identify what the code does, then identify what is wrong with how it does it.
- Run `pnpm test` first to establish a baseline — all tests must still pass after refactoring.

## Step 2: Security
- No unvalidated input reaching the service or database — every entry point must go through a DTO with class-validator.
- No raw string interpolation in queries or file paths — use parameterized Prisma calls.
- No sensitive data (tokens, hashes, OTP codes) returned in API responses.
- No hardcoded secrets or credentials — use config factories.
- Auth checks must use guards (`@CheckAbility`, `@Public`, `@CurrentUser`) — never manual `req.user` comparisons in services.
- Ownership checks must happen before any mutation ("does this booking belong to the caller?").

## Step 3: NestJS anti-patterns
- Business logic in a controller → move to the service.
- Prisma call in a controller → move to the service.
- Role/auth check duplicated in the service when a guard already covers it → remove from service.
- Wrong exception type (e.g. `NotFoundException` for auth failures) → use the semantically correct one.
- Missing `@IsOptional()` on optional DTO fields or vice versa → fix.

## Step 4: Clean code
- Rename anything whose name doesn't reveal its intent.
- Extract repeated logic into a private method.
- Replace magic numbers/strings with named constants or config values.
- Remove dead code and commented-out blocks.
- Flatten deeply nested conditionals using early returns.
- Split any method that does more than one thing.

## Step 5: TypeScript
- Replace every `any` with a proper type or `unknown` + narrowing.
- Replace implicit `any` return types with explicit return type annotations on public methods.
- Ensure all Prisma transaction callbacks are typed (`tx: Prisma.TransactionClient`).

## Step 6: Prisma and data access
- Multiple writes without a transaction → wrap in `$transaction`.
- N+1 query patterns (calling Prisma inside a loop) → use `include` or `findMany` with `where: { id: { in: [...] } }`.
- Fields selected but never used in the response → remove from `select`/`include`.

## Step 7: Tests
- After all changes, run `pnpm test` — all tests must pass.
- If the refactor changed a method signature or behavior, update the corresponding spec.
- If a refactored code path had no test, add one.

## Finish
Report what was changed and why, grouped by category (security, anti-patterns, clean code, etc.).
