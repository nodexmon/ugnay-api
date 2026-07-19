Apply this checklist when creating a brand-new domain module.

## Step 1 — Schema (if needed)

- If the module needs a new Prisma model, run the `/migrate` skill first.
- Do not write any module code until `pnpm prisma generate` has completed successfully.

## Step 2 — Create files in this order

```
src/modules/[name]/
  [name].module.ts
  [name].service.ts
  [name].controller.ts
  [name].assertions.ts
  [name].constants.ts   ← only if the module has thresholds, enum maps, or sort arrays
  [name].types.ts       ← only if the module defines its own types or enums
  dto/
    *.dto.ts
```

## Step 3 — Service template

```typescript
@Injectable()
export class [Name]Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: [Name]Assertions,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  // ─── Private: business logic ─────────────────────────────────────────────────
}
```

- `private readonly` on every constructor param.
- Two section dividers — no others.

## Step 4 — Assertions class template

```typescript
@Injectable()
export class [Name]Assertions {
  constructor(private readonly prisma: PrismaService) {}

  async assert[Condition](...): Promise<void> { ... }   // validate + throw only
  async find[Entity](...): Promise<[Entity]> { ... }    // fetch + validate + return
}
```

## Step 5 — Module wiring

```typescript
@Module({
  imports: [...],
  controllers: [[Name]Controller],
  providers: [[Name]Service, [Name]Assertions],
  exports: [[Name]Service],   // export only what other modules actually need
})
export class [Name]Module {}
```

- Register `[Name]Assertions` in `providers`. Forgetting this causes a DI runtime error.
- Import the module in `app.module.ts` (or the consuming module) — not both.

## Step 6 — Spec files

Create three spec files:
- `[name].service.spec.ts` — mock assertions class + Prisma
- `[name].controller.spec.ts` — mock service entirely
- `[name].assertions.spec.ts` — mock PrismaService directly

Follow the `/write-tests` standards for setup and structure.

## Step 7 — Verify

- `pnpm test` — all tests must pass before committing.
- `pnpm build` — must compile cleanly (catches missing imports, DI mismatches).
