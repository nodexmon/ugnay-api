Apply this reference when deciding which NestJS exception to throw. All exceptions import from `@nestjs/common`.

## Decision table

| Situation | Exception |
|---|---|
| Required entity not found in DB | `NotFoundException` |
| Entity already in a conflicting state | `ConflictException` |
| Booking state changed under a concurrent caller | `ConflictException` |
| Caller lacks ownership of the resource | `ForbiddenException` |
| Worker is offline, suspended, or unverified | `ForbiddenException` |
| User input violates a business constraint (not a missing entity) | `BadRequestException` |
| File is missing, wrong type, or too large (in a pipe) | `BadRequestException` |
| OTP is invalid or expired | `UnauthorizedException` |
| Refresh/registration token is invalid | `UnauthorizedException` |
| SMS or external API call fails | `InternalServerErrorException` |

---

## NotFoundException — resource not found

```typescript
// In an assertions class:
if (!worker) throw new NotFoundException('Worker profile not found.');
if (!booking) throw new NotFoundException('Booking not found.');
if (!session) throw new NotFoundException('Session not found or already revoked.');
```

**Message pattern:** `'{Resource} not found.'` — period at the end, no extra context.

Never throw this for an entity that *exists but is in a wrong state* — that's `ConflictException` or `ForbiddenException`.

---

## ConflictException — wrong state or duplicate

```typescript
// Duplicate resource:
throw new ConflictException('Worker profile already exists.');
throw new ConflictException('Phone number already registered.');

// Wrong business state:
throw new ConflictException('Worker is already verified.');
throw new ConflictException('Credential has already been reviewed.');

// Race condition (updateMany count === 0 guard):
if (result.count === 0) throw new ConflictException('Booking is no longer pending.');
```

**Message pattern:** `'{Subject} already {state}.'` or `'{Subject} is no longer {state}.'`

Use `ConflictException` for state problems, not `BadRequestException`. HTTP 409 tells the client the resource is in a conflicting state; HTTP 400 implies bad input.

---

## ForbiddenException — permission and state violations

```typescript
// Ownership failure:
throw new ForbiddenException('Insufficient permissions.');

// Business state that blocks access (not a missing resource, not wrong state):
throw new ForbiddenException('Worker must be verified before going online.');
throw new ForbiddenException('Worker account is suspended.');
throw new ForbiddenException('Worker is not available.');
```

**Do not** throw `ForbiddenException` for things the CASL guard already catches — the guard throws it automatically with a standardised message. Only throw it manually when application-layer business rules (not RBAC) block the operation.

**`ForbiddenException` vs `UnauthorizedException`:** Forbidden = authenticated but blocked. Unauthorized = not authenticated or token invalid. Do not swap them.

---

## BadRequestException — invalid input

```typescript
// Business constraint violations:
throw new BadRequestException('Duplicate categories are not allowed.');
throw new BadRequestException('Maximum of 5 active credentials allowed.');
throw new BadRequestException('Scheduled booking must be within 7 days.');

// File validation (in pipes):
throw new BadRequestException('idPhoto file is required');
throw new BadRequestException('avatar must be a JPEG, PNG, or WEBP image');
throw new BadRequestException('credential file must not exceed 5MB');
```

**Use sparingly in services.** The global `ValidationPipe` handles DTO validation automatically — only throw `BadRequestException` manually for business rules that can't be expressed as class-validator decorators.

---

## UnauthorizedException — auth flow failures

```typescript
throw new UnauthorizedException('Invalid refresh token.');
throw new UnauthorizedException('Invalid or expired OTP');
throw new UnauthorizedException('Account is inactive.');
```

Only used inside the auth module for token/OTP verification. The global `JwtAuthGuard` handles every other 401 automatically.

---

## InternalServerErrorException — external service failures only

```typescript
throw new InternalServerErrorException('Failed to send SMS.');
throw new InternalServerErrorException('Failed to sync barangays from PSGC API.');
```

Only throw this when an **external integration** (HTTP call, third-party API) fails. Never throw it for application logic errors — use a more specific exception. The global `AllExceptionsFilter` converts all uncaught errors to a 500 anyway, with the stack hidden from the response.

---

## Rules

- Always end manual exception messages with a period.
- Throw exceptions **in assertions classes**, not in service methods. Services call `this.assertions.assertX()`.
- Never throw `HttpException` directly — use a named subclass.
- Never catch and re-throw with a different status to change the response code — fix the throw site instead.
- `ConflictException` for state, `BadRequestException` for input. They are not interchangeable.
