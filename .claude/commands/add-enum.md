Apply this checklist when adding a new Prisma enum to the schema.

## Step 1 — Define in schema.prisma

```prisma
enum MyStatus {
  PENDING
  ACTIVE
  CLOSED
}
```

Add the `enum` block near the top of `prisma/schema.prisma` with the other enums (lines 19–87). Then reference it in the model:

```prisma
model MyModel {
  status MyStatus @default(PENDING)
}
```

Then run `/migrate` with a descriptive name: `add_my_status_enum`.

---

## Step 2 — Import from the generated client

Always import enum values from the generated client, never from `@prisma/client`:

```typescript
import { MyStatus } from '@/generated/prisma/enums';
```

This import path applies everywhere: services, assertions, DTOs, constants, specs.

---

## Step 3 — Add to DTOs

**Required field:**
```typescript
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MyStatus } from '@/generated/prisma/enums';

export class UpdateMyModelDto {
  @ApiProperty({ enum: MyStatus })
  @IsEnum(MyStatus)
  status: MyStatus;
}
```

**Optional filter (query DTO):**
```typescript
@ApiProperty({ enum: MyStatus, required: false })
@IsOptional()
@IsEnum(MyStatus)
status?: MyStatus;
```

See `/dto` for the full DTO checklist.

---

## Step 4 — Add to constants (if grouped logic applies)

If the enum's values are used in grouped checks across the codebase, define a `Set` or array in the relevant `*.constants.ts`:

```typescript
import { MyStatus } from '@/generated/prisma/enums';

// Group that shares some behaviour:
export const ACTIVE_STATUSES = new Set<MyStatus>([
  MyStatus.PENDING,
  MyStatus.ACTIVE,
]);
```

Real example: `CONTACT_REVEAL_STATUSES` in `src/modules/bookings/bookings.constants.ts`.

---

## Step 5 — Use in assertions and services

```typescript
import { MyStatus } from '@/generated/prisma/enums';

// In assertions:
if (model.status !== MyStatus.ACTIVE)
  throw new ForbiddenException('Model must be active.');

// In services (status-safe updateMany guard):
const result = await tx.myModel.updateMany({
  where: { id, status: MyStatus.PENDING },
  data: { status: MyStatus.ACTIVE },
});
if (result.count === 0)
  throw new ConflictException('Status has changed.');
```

---

## CASL subjects — enums are NOT subjects

CASL subjects in `src/casl/casl.types.ts` are model **name strings** (`'WorkerProfile'`, `'Booking'`), not Prisma enums. Only add a new CASL subject when a new **model** needs permission gating. Use `/add-permission` for that.

---

## Seed data

`prisma/seed.ts` seeds `ServiceCategory` and `Barangay` only. Most enums do not require seed entries — DB defaults (`@default(PENDING)`) handle initial state. Only update seed if the seeded entities reference the new enum field directly.

---

## Rules

- Import enum values from `@/generated/prisma/enums`, not `@prisma/client`.
- Always add `@ApiProperty({ enum: MyEnum })` alongside `@IsEnum(MyEnum)` in new DTOs.
- Run `pnpm prisma generate` after every migration — enum types live in the generated client.
- Add to a constants `Set` when the same group of values appears in more than one place.
- Do not add the enum as a CASL subject — subjects are model names.
