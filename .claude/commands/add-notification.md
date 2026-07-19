Apply this checklist when sending a push notification from any service method.

`NotificationsService` is `@Global()` — inject it directly into the constructor. No need to import `NotificationsModule` in the consuming module.

## Choose the right pattern

### Pattern A — Direct fire-and-forget (userId already in scope)

```typescript
void this.notifications.sendToUser(userId, {
  title: 'Booking accepted',
  body: 'Your booking has been accepted.',
}).catch(() => {});
```

Use when the userId is already available (from a method argument, the JWT payload, or a previously fetched entity).

### Pattern B — Named private method (userId requires a DB fetch)

```typescript
// Call site (in the public method):
void this.notifyBookingParty(bookingId, 'worker', {
  title: 'New booking request',
  body: 'A customer has requested your service.',
}).catch(() => {});

// Private helper (in the Private: business logic section):
private async notifyBookingParty(
  bookingId: string,
  party: 'worker' | 'customer',
  message: { title: string; body: string },
): Promise<void> {
  const booking = await this.prisma.booking.findUnique({
    where: { id: bookingId },
    include: { worker: { select: { userId: true } }, customer: { select: { userId: true } } },
  });
  if (!booking) return;
  const userId = party === 'worker' ? booking.worker.userId : booking.customer.userId;
  await this.notifications.sendToUser(userId, message);
}
```

Use when the userId is not in scope and a Prisma lookup is needed. The private method is still called with `void ... .catch(() => {})` at the call site.

### Pattern C — After a transaction (notification must follow DB commit)

```typescript
return this.prisma
  .$transaction(async (tx) => {
    // ... DB writes ...
    return result;
  })
  .then((result) => {
    void this.notifications.sendToUser(userId, {
      title: 'Verification approved',
      body: 'Your profile has been verified.',
    }).catch(() => {});
    return result;
  });
```

Use when the notification must only fire after the transaction commits successfully. Chain `.then()` on the transaction promise — never `await` a notification inside the transaction callback.

## Rules

- **Never** `await` a notification call in the main flow — it must never block or throw.
- **Never** use an inline async IIFE: `void (async () => { await notify(); })()`. Extract a named private method (Pattern B) instead.
- Always chain `.catch(() => {})` — without it, a failed send becomes an unhandled rejection.
- A private helper must return `Promise<void>` and guard against a missing entity with `if (!entity) return;`.

## Inject the service

```typescript
constructor(
  // ...other deps
  private readonly notifications: NotificationsService,
) {}
```

Import: `import { NotificationsService } from '@/modules/notifications/notifications.service';`
