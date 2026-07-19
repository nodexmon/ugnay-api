Apply this checklist when a migration fails, needs to be rolled back, or the DB and schema have drifted out of sync.

## Step 0 — Check status first

```bash
pnpm prisma migrate status
```

This shows every migration: Applied, Pending, or Failed. Start here before doing anything else.

---

## Scenario A — Undo the last dev migration (not yet committed to git)

1. Delete the migration folder: `prisma/migrations/YYYYMMDDHHMMSS_name/`
2. Revert the schema changes in `prisma/schema.prisma`
3. Align the local DB with the current schema:
   ```bash
   pnpm prisma db push --force-reset
   ```
4. Regenerate the client:
   ```bash
   pnpm prisma generate
   ```

> Only use this approach before the migration is committed. Once it's in git history, use Scenario B.

---

## Scenario B — A migration applied partially or failed mid-run

```bash
# Tell Prisma to stop treating it as pending
pnpm prisma migrate resolve --rolled-back YYYYMMDDHHMMSS_migration_name
```

Then either fix the migration SQL in the existing file, or delete the folder and re-create:
```bash
pnpm prisma migrate dev --name fixed_description
```

---

## Scenario C — Schema edited directly without running migrate (schema/DB drift)

```bash
# Preview what migration Prisma would generate — does NOT apply it
pnpm prisma migrate dev --create-only --name drift_fix
```

Review the generated SQL in `prisma/migrations/*/migration.sql`. Edit it if needed. Then apply:
```bash
pnpm prisma migrate dev
```

---

## Scenario D — Full local reset (dev only, destructive)

```bash
pnpm prisma migrate reset
```

Drops the entire database, re-runs all migrations from scratch, then re-seeds. **Destroys all local data.** Only use in development when you want a clean slate.

---

## Scenario E — Production migration failure

Production uses `pnpm db:migrate:deploy` (non-interactive). If it fails:

1. Check what happened in the migration tracking table:
   ```sql
   SELECT migration_name, finished_at, logs FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;
   ```
   A failed row has `finished_at = NULL` and an error in `logs`.

2. Fix the SQL in the migration file.

3. Re-run — Prisma will retry the failed migration:
   ```bash
   pnpm db:migrate:deploy
   ```

4. If the migration can't be fixed in-place, mark it rolled-back and create a corrected replacement:
   ```bash
   pnpm prisma migrate resolve --rolled-back YYYYMMDDHHMMSS_name
   # edit migration file or create a new corrected one
   pnpm db:migrate:deploy
   ```

---

## `db push` vs `migrate dev` — when to use which

| Command | Use for |
|---|---|
| `pnpm db:migrate` | All schema changes during development — creates a migration file |
| `pnpm prisma migrate dev --create-only` | Preview migration SQL before applying |
| `prisma db push` | Throwaway prototyping only — does NOT create a migration file |
| `pnpm db:migrate:deploy` | CI/CD and production — applies existing files only |

**Never use `db push` when you intend to keep the change** — it leaves no migration file and will break deploys.

---

## Rules

- Never manually edit a migration file that has already been applied to a shared or production database.
- Always run `pnpm prisma generate` after any schema or migration change.
- Confirm `pnpm prisma migrate status` shows all migrations as `Applied` before committing or opening a PR.
