Apply these rules when writing or reviewing any Prisma query.

## select vs include

`select` returns only the fields you name — use it when you are building a response shape.
`include` returns the full model plus the named relations — use it when you need the entity for internal operations.

```typescript
// ✅ select — building a response for the client
const barangay = await this.prisma.barangay.findUnique({
  where: { id },
  select: { id: true, name: true, centroidLat: true, centroidLng: true },
});

// ✅ include — internal operation needs the full model
const worker = await this.prisma.workerProfile.findUnique({
  where: { userId },
  include: WORKER_INCLUDE,
});

// ✅ combine — include a relation but only select specific fields from it
include: {
  customer: { select: { userId: true } },
}
```

---

## findUnique vs findFirst

Use `findUnique` when filtering on a field with a `@unique` or `@@unique` constraint — it uses the index directly and guarantees at most one result.

Use `findFirst` when filtering on non-unique fields or combining multiple conditions.

```typescript
// ✅ unique field → findUnique
await this.prisma.workerProfile.findUnique({ where: { userId } });
await this.prisma.noShowReport.findUnique({ where: { bookingId } });

// ✅ non-unique filter or multiple conditions → findFirst
await tx.verificationDoc.findFirst({
  where: { workerId, status: VerificationStatus.PENDING },
});
await this.prisma.booking.findFirst({
  where: { id, customer: { userId: user.sub } },
  include: { ... },
});
```

**Never use `findUniqueOrThrow` or `findFirstOrThrow`.** The codebase always checks for null manually and throws a typed NestJS exception from the assertions class. This gives consistent error messages and the right HTTP status code.

---

## Reusable shapes go in src/common/constants/

When the same include or select shape is used in more than one place, extract it to `src/common/constants/`:

```typescript
// src/common/constants/worker-includes.ts
export const PUBLIC_WORKER_INCLUDE = {
  homeBarangay: true,
  categories: { include: { category: true } },
  credentials: {
    where: { status: 'APPROVED' as const },
    select: { type: true },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

export const WORKER_INCLUDE = {
  ...PUBLIC_WORKER_INCLUDE,
  verificationDocs: { orderBy: { createdAt: 'desc' as const } },
  credentials: { orderBy: { createdAt: 'desc' as const } },
} as const;

export const ADMIN_WORKER_INCLUDE = {
  ...WORKER_INCLUDE,
  user: { select: { id: true, phone: true, status: true } },
} as const;
```

Design principle: each constant extends the previous one with more fields. Minimal constants (like `BOOKING_PARTY_IDS_INCLUDE`) exist for high-frequency fire-and-forget operations that only need `userId`.

---

## Relation filters in where

```typescript
// Has at least one matching relation
categories: { some: { categoryId, category: { isActive: true } } }

// Has no matching relation  
bookings: { none: { status: { in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS] } } }

// 1:1 filter through relation
user: { status: UserStatus.ACTIVE }
customer: { userId: user.sub }
```

---

## Pagination — always use $transaction([findMany, count])

See `/paginate`. The `where` clause must be identical on both queries:

```typescript
const [items, total] = await this.prisma.$transaction([
  this.prisma.booking.findMany({ where, orderBy, skip, take }),
  this.prisma.booking.count({ where }),
]);
return { items, total, skip, take };
```

---

## orderBy

All `orderBy` values are hardcoded — never accept sort direction from the client.

| Context | orderBy |
|---|---|
| Admin queues (FIFO processing) | `{ createdAt: 'asc' }` |
| User-facing lists (newest first) | `{ createdAt: 'desc' }` |
| Worker search | `[{ averageRating: 'desc' }, { totalReviews: 'desc' }, { createdAt: 'desc' }]` |
| Alphabetical reference data | `{ name: 'asc' }` |

Multi-field orderBy is an array, not an object.

---

## Aggregations

Use `aggregate` only when denormalizing data back to a parent record:

```typescript
const { _avg, _count } = await tx.review.aggregate({
  where: { workerId },
  _avg: { rating: true },
  _count: true,
});
await tx.workerProfile.update({
  where: { id: workerId },
  data: { averageRating: _avg.rating ?? 0, totalReviews: _count },
});
```

Do not use `_count` inside `select`/`include` — use a separate `count()` call or the batch `$transaction([findMany, count])` pattern.

---

## Loops vs batches

Never call Prisma inside a `for` loop on a large dataset. Fetch once, then batch:

```typescript
// ✅ fetch all, then process in parallel
const expired = await this.prisma.booking.findMany({ where, take: 100 });
await Promise.all(expired.map((b) => this.notifications.sendToUser(...)));

// ✅ batch write
await tx.workerCategory.deleteMany({ where: { workerId } });
await tx.workerCategory.createMany({ data: newCategories });

// ❌ N+1 — Prisma call inside a loop
for (const item of items) {
  await this.prisma.model.update({ where: { id: item.id }, ... });
}
```

The only acceptable loop with Prisma inside is a background sync service operating on a known-small external dataset (e.g., `barangay-sync.service.ts`).

---

## Unbounded queries

Only skip pagination when the dataset is provably small and bounded by domain:

| Table | Safe? | Reason |
|---|---|---|
| `barangay` | ✅ | ~1 200 records max (Calapan City only) |
| `serviceCategory` | ✅ | ~30–50 records |
| Any user-owned records | ❌ | Scales with user growth |
| Any booking/review records | ❌ | Scales with usage |

---

## upsert

Use `upsert` only for genuinely idempotent operations (same input, same result):

```typescript
await this.prisma.pushToken.upsert({
  where: { token },
  update: { userId, platform },
  create: { userId, token, platform },
});
```

Do not use `upsert` as a shorthand to avoid checking existence — use `findUnique` + `create`/`update` when the create and update paths have different logic.

---

## Rules

- `select` for responses; `include` for internal entities.
- `findUnique` on unique fields; `findFirst` for multi-condition filters.
- Never `findUniqueOrThrow`/`findFirstOrThrow` — throw typed NestJS exceptions in assertions.
- Never `orderBy` from client input — hardcode sort order.
- Never Prisma inside a loop on a large dataset — batch with `deleteMany`/`createMany` or `Promise.all`.
- Reusable shapes belong in `src/common/constants/` as `as const`.
