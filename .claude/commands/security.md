Run through this checklist after implementing any new endpoint or feature, before committing.

## Authentication

`JwtAuthGuard` is registered globally via `APP_GUARD` — every route requires a valid JWT by default.

Add `@Public()` **only** for routes that must be unauthenticated:
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `POST /auth/register`
- `POST /auth/refresh`
- `GET /uploads/*path`

Every other route stays protected. If you think a new route needs `@Public()`, confirm it can never be abused without an account.

## Authorization

Every non-public route must have `@CheckAbility(Action, 'Subject')`.

After adding it, cross-check `src/casl/casl-ability.factory.ts` — confirm the permission is actually granted for the roles you intend. A missing grant silently throws 403 for all users.

CASL enforces **role**. The service must additionally enforce **row-level ownership**:

```typescript
// ❌ CASL says CUSTOMER can Read Booking — but this returns ANY booking
await this.prisma.booking.findUnique({ where: { id } });

// ✅ ownership enforced at the DB layer
await this.prisma.booking.findFirst({
  where: { id, customer: { userId: user.sub } },
});
```

One without the other is an authorization hole.

## Input validation

**DTOs** — every field must have class-validator decorators. `ValidationPipe` (global, `whitelist: true`, `forbidNonWhitelisted: true`) automatically strips unknown fields and rejects invalid ones — but only if the DTO is properly annotated. An unannotated field passes through silently.

**UUID path params** — every `@Param('id')` must use `new ParseUUIDPipe()`:

```typescript
// ✅
@Get(':id')
findOne(@Param('id', new ParseUUIDPipe()) id: string) { ... }

// ❌ — a non-UUID string reaches Prisma and surfaces as a raw adapter error
@Get(':id')
findOne(@Param('id') id: string) { ... }
```

**Numeric query params** — add `@Type(() => Number)` alongside `@IsInt()` so `ValidationPipe`'s `transform: true` coerces the query string to a number:

```typescript
@IsOptional()
@IsInt()
@Min(0)
@Type(() => Number)
skip?: number = 0;
```

**File uploads** — mime type and size must be validated in a pipe, not in the service. See `/upload-file`.

## Response safety

Before returning any Prisma result, ask: does this response expose data the caller should not see?

Never return:
- Password hashes or raw tokens (none stored, but stay aware)
- `refreshToken` values or their hashes
- `User.status`, `User.phone`, or internal IDs in responses intended for the other party (e.g., the customer should not see the worker's userId — only their public profile fields)

When using `select`, list fields explicitly. Do not return the full model and rely on the caller to ignore sensitive fields — they won't, and the API contract leaks.

## Rate limiting

`ThrottlerGuard` is global — standard endpoints are protected automatically.

High-abuse endpoints that need a stricter limit:

```typescript
@Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
@Post('request-otp')
requestOtp(...) { ... }
```

## Prisma / injection safety

All Prisma ORM queries are parameterized — no SQL injection risk through the query builder.

If raw SQL is ever needed, use tagged template literals (Prisma sanitizes interpolated values):

```typescript
// ✅ — Prisma sanitizes the interpolation
await this.prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;

// ❌ — string concatenation bypasses parameterization
await this.prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${id}'`);
```

Never use `$queryRawUnsafe` with user-supplied values.

## Infrastructure (already configured — do not accidentally remove)

These are set up globally in `main.ts`. Verify they are not accidentally disabled when touching that file:

| Protection | What it does |
|---|---|
| `helmet()` | Sets security HTTP headers (XSS, clickjacking, etc.) |
| `express.json({ limit: '1mb' })` | Blocks oversized request bodies |
| `CORS_ORIGIN` env var | Restricts cross-origin requests; not open by default |
| `AllExceptionsFilter` | Hides stack traces and internal error details from all responses |
| `ThrottlerGuard` | Rate-limits all routes globally |
