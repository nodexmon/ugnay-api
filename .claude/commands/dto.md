Apply these conventions whenever writing or modifying a DTO in this project.

## File location

- DTOs live in `src/modules/[name]/dto/*.dto.ts`.
- One DTO per use case: `create-booking.dto.ts`, `update-worker.dto.ts`, `query-bookings.dto.ts`.

## Validation decorators

- Every field must have at least one `class-validator` decorator.
- Use `@IsOptional()` only when the field is genuinely optional in the domain — not for convenience.
- Order decorators consistently: `@IsOptional()` first, type decorator second, constraint decorators after.
- Use `@Type(() => Number)` (from `class-transformer`) for numeric query string fields — query params arrive as strings.
- Use `@IsEnum(MyEnum)` for enum fields; import the enum from `src/generated/prisma` or the module's `types.ts`.

## Composition utilities

- Extend `PartialType(CreateXDto)` for update DTOs where all fields become optional.
- Use `PickType` or `OmitType` to derive a subset DTO rather than duplicating fields.
- Never duplicate the same field definition across two DTOs — compose instead.

## Body vs query string

- Request body DTOs: class decorated with no extra decorator needed (ValidationPipe handles it).
- Query string DTOs: use `@Query() dto: QueryDto` in the controller; add `@Type()` for numbers/booleans.

## Rules

- No `any` types in DTOs.
- No business logic in DTOs — they are data shapes only.
- Do not add fields that aren't consumed by the service. The global pipe enforces `forbidNonWhitelisted`.
- If a field maps directly to a Prisma field, the name should match the schema unless there's a clear API reason not to.

## Pagination DTOs

Reuse the skip/take pattern consistently:

```typescript
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(0)
skip?: number = 0;

@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
take?: number = 10;
```

Never expose raw Prisma cursor pagination to the mobile client.
