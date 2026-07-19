Apply these rules before adding any abstraction, class, utility, or configuration. Scope every implementation to what the current task actually requires — nothing more.

## The rule of three

Do not extract shared logic until it appears in **three or more places**. Two similar blocks is a coincidence. Three is a pattern worth abstracting.

```typescript
// ❌ — extracted after appearing twice; now two callers of a wrapper that adds no value
function buildWhereClause(id: string) {
  return { where: { id } };
}

// ✅ — write it inline both times; wait for a third before extracting
const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
const worker  = await this.prisma.workerProfile.findUnique({ where: { id: workerId } });
```

---

## Abstractions

Only introduce an abstraction when it removes real duplication or hides a genuinely complex concern. Never abstract "in case we need it later."

```typescript
// ❌ — interface with exactly one implementation, never to be extended
interface BookingCreator {
  create(dto: CreateBookingDto): Promise<Booking>;
}
class BookingCreatorImpl implements BookingCreator { ... }

// ✅ — just the service method
async createBooking(dto: CreateBookingDto): Promise<Booking> { ... }

// ❌ — base DTO because two DTOs share one optional field
class BaseFilterDto { skip?: number; }
class FindBookingsQueryDto extends BaseFilterDto { status?: BookingStatus; }
class FindUsersQueryDto extends BaseFilterDto { role?: Role; }

// ✅ — extend PaginationDto (the one shared base already in the codebase)
class FindBookingsQueryDto extends PaginationDto { status?: BookingStatus; }
```

---

## Classes and files

Don't create a new class, file, or module for a single method or a trivial wrapper.

```typescript
// ❌ — new assertions method that is just one Prisma call with no business logic
async assertPhoneIsUnique(phone: string): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { phone } });
  if (user) throw new ConflictException('Phone number already registered.');
}
// If this check only exists in one place, inline it in the service method.

// ❌ — private helper that wraps a single expression
private getExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}
// ✅ — just write it inline
const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
```

New assertions methods belong in an assertions class only when:
- The check is called from **two or more places**, OR
- The logic involves multiple conditions or a DB query + state validation.

---

## TypeScript generics

Add a generic parameter only when the function is genuinely called with more than one concrete type.

```typescript
// ❌ — generic that is only ever called with one type
async findById<T>(id: string): Promise<T> {
  return this.prisma.booking.findUnique({ where: { id } }) as T;
}

// ✅ — typed directly
async findById(id: string): Promise<Booking> {
  return this.prisma.booking.findUnique({ where: { id } });
}
```

---

## Configuration vs constants

Don't promote a value to an env var or config factory unless it genuinely differs across environments. Thresholds and business rules are constants, not configuration.

```typescript
// ❌ — env var for a rule that never changes between dev/staging/prod
MAX_STRIKE_COUNT=3  // in .env

// ✅ — module constant
export const MAX_STRIKE_COUNT = 3; // in bookings.constants.ts
```

Only add to a config factory (`registerAs`) when the value:
- Changes between environments (dev / staging / prod), OR
- Is a secret or external URL.

---

## Function signatures

Don't add optional parameters for callers that don't exist yet.

```typescript
// ❌ — options bag for a hypothetical future caller
async createBooking(
  dto: CreateBookingDto,
  options?: { skipNotification?: boolean; dryRun?: boolean },
): Promise<Booking>

// ✅ — exactly what the current callers need
async createBooking(dto: CreateBookingDto): Promise<Booking>
```

No flag parameters. If two call sites need different behaviour, write two methods.

```typescript
// ❌
async findUser(id: string, includeInactive: boolean) { ... }

// ✅
async findActiveUser(id: string): Promise<User> { ... }
async findUser(id: string): Promise<User> { ... }
```

---

## Constants files

Don't create a `[module].constants.ts` file for a single constant. Inline it or co-locate it in the file that owns it. Extract to a constants file only when there are **three or more** related constants that multiple files reference.

---

## Before adding anything, ask

1. **Is this used right now?** If not, don't write it.
2. **Does this appear in three or more places?** If not, keep it inline.
3. **Does this hide real complexity?** If the abstraction is thinner than the code it wraps, delete it.
4. **Will this parameter ever have a second value?** If not, remove it.
5. **Is this env-var-worthy?** If it doesn't change between environments, make it a constant.

If you answered "no" to all five — you're about to overengineer. Stop.
