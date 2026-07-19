Apply this checklist when adding a new scheduled background job.

## Step 1 — Create the cron file

`src/modules/[name]/[name].cron.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class [Name]Cron {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async myJob(): Promise<void> {
    const items = await this.prisma.myModel.findMany({
      where: { status: 'PENDING' },
      take: 100,
    });
    if (!items.length) return;

    // process items ...

    this.logger.log(`[Name]Cron: processed ${items.length} items`);
  }
}
```

## Conventions

**Batch cap** — always `take: 100` (or lower). Never run an unbounded query in a cron.

**Early return** — if the query returns nothing, return immediately. Log nothing on no-op runs; logs on every tick are noise.

**Status-safe transitions** — if you update records found by `findMany`, use `updateMany` with the expected status in the `where` clause:
```typescript
await this.prisma.myModel.updateMany({
  where: { id: { in: ids }, status: 'PENDING' },  // ← re-check status
  data: { status: 'EXPIRED' },
});
```
This prevents overwriting a record that changed state between the `findMany` and the `updateMany`.

**Per-item error isolation** — wrap each per-item side effect (notifications, external calls) with `.catch(() => {})`. One failure must not abort the batch:
```typescript
await Promise.all(
  items.map((item) =>
    this.notifications.sendToUser(item.userId, msg).catch(() => {}),
  ),
);
```

**Logging** — one `this.logger.log(...)` line when work occurs. No logs on empty runs.

## Step 2 — Register in module

Add `[Name]Cron` to `providers` in `[name].module.ts`. Add any dependency modules to `imports` (e.g. `NotificationsModule`).

`ScheduleModule.forRoot()` is already registered globally in `app.module.ts` — no changes needed there.

## Step 3 — Tests

`src/modules/[name]/[name].cron.spec.ts` — three required cases:

1. **Happy path** — records found, processed, side effects called, logged.
2. **Empty result** — no records returned, method returns early, no side effects, no log.
3. **Partial failure** — one per-item side effect rejects; batch completes, no throw, other items still processed.

Setup pattern:
```typescript
const prisma = { myModel: { findMany: jest.fn(), updateMany: jest.fn() } };
const notifications = { sendToUser: jest.fn() };
const logger = { log: jest.fn(), error: jest.fn() };

// providers: [Name]Cron + mocks for PrismaService, NotificationsService, Logger
```

Use `mockResolvedValue` / `mockRejectedValueOnce` to control behavior per test. Call `jest.clearAllMocks()` in `beforeEach`.

## Before finishing

- `pnpm test` — all tests must pass.
- Confirm the cron class appears in the module's `providers` array or it will silently never run.
