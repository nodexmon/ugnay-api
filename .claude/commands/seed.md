Apply these conventions when adding or modifying seed data in `prisma/seed.ts`.

## Core rule: always idempotent

Every seed operation must be safe to run multiple times. Use `upsert` with a stable unique key — never `create`.

```typescript
await prisma.serviceCategory.upsert({
  where: { name: 'Electrical' },
  update: {},
  create: { name: 'Electrical', description: '...' },
});
```

## Insertion order — always respect FK dependencies

Seed in this order to satisfy foreign key constraints:

1. `ServiceCategory` and `Barangay` (no dependencies)
2. `User` (no dependencies)
3. `Customer` (depends on `User`)
4. `Worker` (depends on `User` and `ServiceCategory`)
5. `Booking` (depends on `Customer` and `Worker`)
6. `Review` (depends on `Booking`)

## Enum values

Import enums from the generated Prisma client, not from hand-written strings:

```typescript
import { BookingStatus, WorkerVerificationStatus } from '@/generated/prisma';
```

Never hardcode enum values as raw strings — they will silently fail if the enum name changes.

## After a migration that adds a required field

- Update all relevant `upsert` / `create` calls in `seed.ts` to include the new field.
- Run `pnpm db:seed` after the migration to confirm the seed still works.
- If the new field has no meaningful seed value, use a sensible placeholder — not `null` on a required column.

## Running the seed

```bash
pnpm db:seed
```

This runs `prisma/seed.ts` via `ts-node`. Confirm the output lists what was upserted.

## Rules

- No raw `prisma.user.create` in seeds — use `upsert`.
- Seed data is for development and demo purposes only. Do not add production-like volumes.
- Phone numbers in seed data must follow the format the OTP service expects (e.g., `+639xxxxxxxxx`).
- If adding a new worker seed, set `verificationStatus: WorkerVerificationStatus.VERIFIED` so the worker can accept bookings without manual admin intervention.
