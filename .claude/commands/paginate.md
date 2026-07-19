Apply this checklist when implementing a list endpoint that returns `{ items, total, skip, take }`.

> Non-admin list endpoints (`/bookings`, `/workers/search`, `/reviews/my`) return plain arrays — they do not use this pattern. Use this skill for admin or management endpoints where the client needs a total count for pagination controls.

## Step 1 — Query DTO

Extend `PaginationDto` from `@/common/dto/pagination.dto`:

```typescript
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { MyEnum } from '@/generated/prisma/enums';

export class FindMyEntitiesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(MyEnum)
  status?: MyEnum;
}
```

`PaginationDto` already provides `skip` (default 0, min 0) and `take` (default 10, max 50) with `@Type(() => Number)` coercion. Do not redeclare these fields.

File location: `src/modules/[name]/dto/find-[name]-query.dto.ts`

## Step 2 — Service method

Run `findMany` and `count` together in a single `$transaction`:

```typescript
async findMyEntities(query: FindMyEntitiesQueryDto) {
  const where = {
    ...(query.status && { status: query.status }),
  };
  const [items, total] = await this.prisma.$transaction([
    this.prisma.myModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    }),
    this.prisma.myModel.count({ where }),
  ]);
  return { items, total, skip: query.skip, take: query.take };
}
```

**Rules:**
- `findMany` and `count` must use the **same** `where` clause — any mismatch causes the total to lie.
- `count` never takes `skip` or `take`.
- Echo `skip` and `take` back in the response so the client knows which page it received.
- Always include `orderBy` — unordered pagination produces inconsistent pages.

## Step 3 — Controller method

```typescript
@Get('my-entities')
findMyEntities(@Query() query: FindMyEntitiesQueryDto) {
  return this.service.findMyEntities(query);
}
```

Apply `@CheckAbility` as required. No special return type annotation needed.

## Step 4 — Update handout

Add the endpoint to `docs/UGNAY_API_HANDOUT.md` with the response shape:

```
GET /[prefix]/my-entities?skip=0&take=10&status=PENDING
→ { items: [...], total: 42, skip: 0, take: 10 }
```

## Before finishing

- `pnpm test` — all tests must pass.
- Add a service spec test that verifies `$transaction` is called with both `findMany` and `count` using the same `where`.
