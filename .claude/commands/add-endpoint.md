Apply this checklist when adding a new route to an existing controller.

## Step 1 — DTO

- Create or reuse a DTO in `src/modules/[name]/dto/`.
- Apply the `/dto` rules: `class-validator` decorators, no `any`, no business logic.
- Use `PartialType`/`PickType`/`OmitType` instead of duplicating fields from an existing DTO.
- For query string DTOs, add `@Type(() => Number)` on numeric fields.

## Step 2 — Controller method

- Add the method with the correct HTTP decorator (`@Get`, `@Post`, `@Patch`, `@Delete`).
- Apply `@CheckAbility(Action, Subject)` — never skip the permission decorator.
- Add `@CurrentUser() user: AuthJwtPayload` if the handler needs the caller's identity.
- Apply `new ParseUUIDPipe()` on every `:id` route param:
  ```ts
  @Param('id', new ParseUUIDPipe()) id: string
  ```
- Controllers delegate only — no Prisma, no business logic, no assertions.

## Step 3 — Service method

- Add one method per use case under the `// ─── Public API ───` divider.
- Call `this.assertions.assertX(...)` for void guards, `const entity = await this.assertions.findX(...)` when you need the entity.
- All Prisma calls go in the service. Wrap multiple writes in `prisma.$transaction`.
- Fire notifications fire-and-forget: `void this.notifications.sendToUser(...).catch(() => {})`.

## Step 4 — Assertions class (if needed)

- Add new guard or finder methods to `[name].assertions.ts`.
- `assert*` → returns `void`, throws on failure.
- `find*` / `resolve*` → fetches, validates, returns the entity.
- Register the class in the module's `providers` if it isn't already.

## Step 5 — Tests

- **Controller spec**: verify the correct service method is called with the right args. Mock the service entirely.
- **Service spec**: test the happy path return value + all expected error paths. Mock the assertions class and Prisma.
- One `it` per behavior (not per method). Error paths use `expect(...).rejects.toBeInstanceOf(...)`.
- Run: `pnpm jest src/modules/[name]/[name].controller.spec.ts src/modules/[name]/[name].service.spec.ts`

## Step 6 — Docs

- If the endpoint is public-facing, update `docs/UGNAY_API_HANDOUT.md` with the route, request shape, and response shape.
- If a new enum value is used, document it in the handout's enum reference section.

## Before finishing

- `pnpm test` — all tests must pass.
- No `console.log`, no `any`, no commented-out code.
