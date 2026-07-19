Apply this checklist when writing a one-off TypeScript script that needs Prisma but does not run inside the NestJS application (data backfills, bulk corrections, PSGC sync dry-runs, admin utilities).

## When to write a script vs a service method

| Situation | Where to put it |
|---|---|
| One-time data migration after a schema change | Script in `prisma/` |
| Recurring admin operation that could be triggered via API | Service method + endpoint |
| Bulk update that runs once at deploy time | Script in `prisma/` |
| Anything that needs NestJS DI (notifications, config, etc.) | Service method |

Scripts are for operations that run outside the HTTP lifecycle. If you need NestJS guards, services, or the DI container, write a service method instead.

---

## File location and naming

```
prisma/           ← DB-related scripts (migrations, backfills, seed variants)
scripts/          ← General utility scripts (create one if it doesn't exist)
```

Name descriptively: `prisma/backfill-worker-status.ts`, `scripts/sync-barangays.ts`.

---

## Script template

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  }),
});

async function main() {
  // your logic here
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Key points:**
- Import `PrismaClient` from `../src/generated/prisma/client` (relative path — scripts live outside `src/`).
- Import `PrismaPg` from `@prisma/adapter-pg` — same adapter used in `PrismaService`.
- `import 'dotenv/config'` loads `.env` automatically.
- Always `$disconnect()` in both `.then()` and `.catch()` — never leave the connection open.
- `process.exit(1)` on error so the shell/CI picks up the failure.

---

## Run a script

```bash
# One-off run
pnpm tsx prisma/my-script.ts

# If it will be run repeatedly, add a package.json entry:
# "db:backfill-workers": "tsx prisma/backfill-worker-status.ts"
```

`tsx` handles path aliases (`@/`) and TypeScript compilation. Do not use `ts-node` — the project uses `tsx`.

---

## Writing idempotent operations

Scripts should be safe to re-run. Prefer `upsert` and `updateMany` over `create`:

```typescript
// ✅ idempotent — safe to re-run
await prisma.workerProfile.updateMany({
  where: { status: null },
  data: { status: WorkerStatus.PENDING },
});

// ✅ upsert for reference data
await prisma.serviceCategory.upsert({
  where: { name: 'Plumbing' },
  update: {},
  create: { name: 'Plumbing', isActive: true },
});

// ❌ will fail on second run if the record already exists
await prisma.serviceCategory.create({ data: { name: 'Plumbing' } });
```

---

## Batching large datasets

Never load every row into memory. Process in batches:

```typescript
async function main() {
  const BATCH = 100;
  let skip = 0;
  let processed = 0;

  while (true) {
    const rows = await prisma.workerProfile.findMany({
      where: { status: OldStatus.LEGACY },
      take: BATCH,
      skip,
    });
    if (rows.length === 0) break;

    await prisma.workerProfile.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: WorkerStatus.PENDING },
    });

    processed += rows.length;
    console.info(`Processed ${processed} rows`);
    skip += BATCH;
  }

  console.info(`Done. Total: ${processed}`);
}
```

---

## Importing enums and types

```typescript
// ✅ — generated client exports enums alongside the client
import { PrismaClient, WorkerStatus } from '../src/generated/prisma/client';

// ❌ — @prisma/client is the Prisma-managed package, not the generated one
import { WorkerStatus } from '@prisma/client';
```

---

## Dry-run pattern

Add a `--dry-run` flag when the script is destructive or expensive:

```typescript
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const targets = await prisma.booking.findMany({ where: { status: 'STALE' } });
  console.info(`Found ${targets.length} records to update`);

  if (DRY_RUN) {
    console.info('Dry run — no changes written.');
    return;
  }

  await prisma.booking.updateMany({
    where: { id: { in: targets.map((b) => b.id) } },
    data: { status: BookingStatus.CANCELLED },
  });
}
```

Run dry first: `pnpm tsx prisma/my-script.ts --dry-run`

---

## Rules

- Always `$disconnect()` in both `.then()` and `.catch()`.
- Always `process.exit(1)` in `.catch()` — silent failures are not acceptable.
- Write idempotent operations (upsert / updateMany) so re-runs are safe.
- Process large tables in batches of ≤ 100 rows — never `findMany()` with no `take`.
- Import enums from `../src/generated/prisma/client`, not `@prisma/client`.
- Add a `--dry-run` flag to any destructive script before running it in production.
- Log progress with `console.info` — scripts have no NestJS logger.
