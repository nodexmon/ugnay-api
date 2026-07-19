Apply this checklist when wrapping multiple Prisma writes in a transaction, or adding a new operation to an existing transaction.

## The two forms

### Form 1 — Batch (parallel reads, same DB snapshot)

```typescript
const [items, total] = await this.prisma.$transaction([
  this.prisma.myModel.findMany({ where, skip, take }),
  this.prisma.myModel.count({ where }),
]);
```

Use only for parallel read queries that must see the same snapshot (e.g. pagination). No async callback, no `TransactionClient` import needed. See `/paginate`. **Do not use this form for writes.**

### Form 2 — Interactive (multi-step writes)

```typescript
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';

return this.prisma.$transaction(async (tx: TransactionClient) => {
  await tx.modelA.update({ ... });
  const result = await tx.modelB.create({ ... });
  return result;
});
```

Use whenever multiple writes must succeed or fail together, or when conditional branching determines which writes to make. Always type the callback parameter as `TransactionClient`.

---

## What goes INSIDE the transaction

- All Prisma writes that must be atomic together
- Conditional branching that determines which writes to make
- Utility functions and private helpers — pass `tx` as their **first parameter**:

```typescript
// Utility function (src/common/utils/strike.util.ts):
export async function applyStrike(
  tx: TransactionClient,
  workerId: string,
  data: { reason: StrikeReason; issuedBy: string },
): Promise<WorkerProfile> { ... }

// Private service helper:
private async handleCancellationPenalty(
  tx: TransactionClient,
  workerProfileId: string,
): Promise<void> {
  await applyStrike(tx, workerProfileId, { ... });
}

// Call site:
await this.prisma.$transaction(async (tx: TransactionClient) => {
  await this.handleCancellationPenalty(tx, profileId);
  await tx.booking.update({ ... });
});
```

- **Race condition guard** — use `updateMany` with the expected status in `where`, throw `ConflictException` if `count === 0`:

```typescript
const result = await tx.booking.updateMany({
  where: { id: bookingId, status: BookingStatus.PENDING },
  data: { status: BookingStatus.ACCEPTED },
});
if (result.count === 0) {
  throw new ConflictException('Booking status has changed.');
}
```

---

## What goes OUTSIDE the transaction

### File I/O — write BEFORE the transaction

A failed DB write after a successful file write is recoverable (retry the DB write). A missing file after a DB record is created is not.

```typescript
// ✅ File write happens before the transaction opens
await this.fileStorage.write(path, file);

return this.prisma.$transaction(async (tx: TransactionClient) => {
  return tx.myModel.create({ data: { fileUrl: path.relative } });
});
```

### Notifications — chain `.then()` after the transaction

Never `await` a notification inside the callback — it holds the connection open and can cause deadlocks.

```typescript
return this.prisma
  .$transaction(async (tx: TransactionClient) => {
    await tx.verificationDoc.update({ ... });
    return tx.workerProfile.update({ ... });
  })
  .then((result) => {
    void this.notifications.sendToUser(userId, { title, body }).catch(() => {});
    return result;
  });
```

### External API calls

Same rule as notifications — always outside the transaction.

---

## When NOT to use a transaction

- **Single Prisma write** — no transaction needed.
- **Read-only queries** — no transaction needed.
- **Pagination** — use the batch form `$transaction([findMany, count])` via `/paginate`, not the interactive form.

---

## Rules

- Always import `TransactionClient` from `@/generated/prisma/internal/prismaNamespace` — never use `Prisma.TransactionClient`.
- Never `await` notifications, SMS, or external HTTP inside the `$transaction` callback.
- File writes happen before the transaction opens, never inside.
- Utility functions that touch the DB must accept `tx: TransactionClient` as their first parameter.
- Use the race condition guard (`updateMany` + `count === 0` check) whenever two concurrent callers could attempt the same state transition.
