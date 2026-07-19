Apply this checklist when adding a performance index to an existing table. This covers query/batch indexes — FK indexes are covered by `/add-relation`.

## When to add an index

| Signal | Example in this codebase |
|---|---|
| Cron job queries the same fields every minute | `Booking(status, expiresAt)` — the expiry cron runs every 60 seconds |
| Admin queue filters by status | `VerificationDoc(status)`, `WorkerCredential(status)`, `NoShowReport(confirmed)` |
| User list filters by two fields together | `Booking(customerId, status)`, `Booking(workerId, status)` |
| Sort or rank by a numeric field | `WorkerProfile(averageRating)` |
| Two separate indexes cover the same query — consolidate | OTP: separate `phone` and `expiresAt` indexes replaced by `(phone, verified, expiresAt)` |

Do **not** add an index without identifying the specific query it will serve.

## Single-field vs composite

- **Single-field** `@@index([field])` — the query filters on that field alone.
- **Composite** `@@index([fieldA, fieldB])` — the query's `where` clause consistently filters on both fields together.

**Field ordering in a composite index matters:** put the most selective field first (the one that narrows the result set most). Low-cardinality fields (enums, booleans) go last.

```prisma
// status (~5 values) + expiresAt (timestamp, high cardinality)
// → put status first: filters to a small set, then expiresAt narrows further
@@index([status, expiresAt])

// phone (high cardinality) + verified (boolean) + expiresAt
// → phone first, boolean last
@@index([phone, verified, expiresAt])
```

## Schema syntax

```prisma
model MyModel {
  id        String   @id @default(uuid()) @db.Uuid
  status    MyStatus
  createdAt DateTime @default(now())

  @@index([status])              // single-field
  @@index([status, createdAt])   // composite
  @@map("my_models")
}
```

## Steps

1. Identify the service method or cron that will benefit and note its exact `where` / `orderBy` clause.
2. Decide single vs composite based on that clause.
3. Add `@@index` to `prisma/schema.prisma`.
4. Run `/migrate` with a descriptive name: `add_status_expires_index_to_bookings`.
5. Open the generated migration SQL and confirm it contains `CREATE INDEX`.

**Expected SQL:**
```sql
CREATE INDEX "my_models_status_createdAt_idx" ON "my_models"("status", "createdAt");
```

## When replacing two indexes with one composite

Drop the old ones in the same migration:
```sql
DROP INDEX "my_models_status_idx";
DROP INDEX "my_models_createdAt_idx";
CREATE INDEX "my_models_status_createdAt_idx" ON "my_models"("status", "createdAt");
```

Prisma generates this automatically when you remove the old `@@index` entries and add the new composite in the schema — verify the SQL before applying.

## Rules

- Do not index `isActive` alone — boolean fields are too low-cardinality to help.
- Do not add indexes speculatively — only for a known query.
- Indexes slow down writes and consume storage; fewer, well-targeted indexes beat many scattered ones.
- `@@unique` constraints already act as indexes — do not add a separate `@@index` on the same field(s).
