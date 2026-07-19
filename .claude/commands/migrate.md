Apply this checklist whenever changing the Prisma schema (`prisma/schema.prisma`).

## Steps — always in this order

1. **Edit the schema** — add/modify models, fields, relations, or enums.
2. **Run migration:**
   ```bash
   pnpm prisma migrate dev --name <short-description>
   ```
   Use a short, imperative name: `add-worker-availability`, `rename-status-field`.
3. **Regenerate the client:**
   ```bash
   pnpm prisma generate
   ```
4. **Update DTOs** — add/remove fields in any DTO that maps to the changed model. Apply `class-validator` decorators.
5. **Update services** — fix any Prisma calls that reference renamed/removed fields. Check `select`, `where`, `orderBy`, and `create`/`update` payloads.
6. **Update tests** — update mocked return values in spec files to match the new shape. A missing field on a mock is a silent bug.
7. **Run all tests:** `pnpm test` — all must pass before committing.
8. **Commit** using `db` type: `db(workers): add availability fields`.

## Rules

- Never skip `migrate dev` in favor of `db push` during development — migration files must exist.
- Never edit generated files in `src/generated/prisma/` — they are overwritten on each `generate`.
- Never add a `NOT NULL` column without a default or a migration data fill step — it will fail on non-empty tables.
- If you add a new enum, add it to `src/modules/[name]/[name].constants.ts` enum maps as needed.
- One migration per logical change. Do not bundle unrelated schema edits.

## After the migration

- Update `docs/UGNAY_API_HANDOUT.md` if the change affects the public API shape.
- If the seed data is stale (e.g., required field added), update `prisma/seed.ts` to match.
