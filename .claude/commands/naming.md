Apply these rules to every variable, function, class, and type name you write or review.

## Variables

- Name must reveal what the value represents, not its type or lifecycle stage
- No single-letter names except `i`/`j`/`k` in loops and `e` in catch blocks
- No trailing numbers (`user1`, `user2`) — use an array or a more specific name
- Collections are always plural (`bookings`, `workerIds`, not `booking`, `workerId`)

❌ Generic names that reveal nothing:
```typescript
const data = await this.prisma.worker.findMany();
const result = await this.bookings.create(dto);
const temp = booking.expiresAt;
const val = dto.amount;
const obj = { id, status };
const item = items[0];
```

✅ Names that reveal intent:
```typescript
const workers = await this.prisma.worker.findMany();
const createdBooking = await this.bookings.create(dto);
const expiresAt = booking.expiresAt;
const amountInCents = dto.amount;
const bookingSummary = { id, status };
const firstApplicant = applicants[0];
```

❌ `res`, `resp`, `req` outside NestJS/Express handler parameters — use the domain noun:
```typescript
// ❌
const res = await this.smsService.sendOtp(phone);
// ✅
const otpResponse = await this.smsService.sendOtp(phone);
```

---

## Functions & methods

- Always a verb phrase describing the **outcome**, not the mechanism
- Boolean-returning functions use `is*`, `has*`, `can*` prefix
- ❌ `handle`, `process`, `manage`, `do`, `run`, `execute` alone — too vague; append a domain noun

```typescript
// ❌ — what does it handle?
async handle(bookingId: string) { ... }
async process(dto: CreateDto) { ... }
async manage(workerId: string) { ... }

// ✅ — outcome is clear
async expireBooking(bookingId: string) { ... }
async createBooking(dto: CreateBookingDto) { ... }
async suspendWorker(workerId: string) { ... }

// ❌ — verb missing, reads like a noun
async userVerification(userId: string) { ... }

// ✅
async verifyUser(userId: string) { ... }

// ❌ — no is/has/can prefix on boolean return
async workerActive(workerId: string): Promise<boolean> { ... }

// ✅
async isWorkerActive(workerId: string): Promise<boolean> { ... }
```

---

## Classes & interfaces

- Nouns or noun phrases — name the **thing**, not its generic role
- Always pair a role suffix with a domain noun

```typescript
// ❌ — suffix with no domain context
class Helper { ... }
class Manager { ... }
class Handler { ... }
class Util { ... }

// ✅ — domain noun first, role suffix narrows it
class BookingService { ... }
class WorkerAssertions { ... }
class CaslAbilityFactory { ... }
class SmsService { ... }
```

---

## Types & enums

- Type alias names: PascalCase noun or noun phrase — never a verb phrase
- Enum members: `SCREAMING_SNAKE_CASE` (already enforced by Prisma; apply to hand-written enums too)

```typescript
// ❌
type DoBooking = { ... };
type HandleResult = { ... };

// ✅
type BookingPayload = { ... };
type OtpVerifyResult = { ... };

// ❌
enum status { active, inactive }

// ✅
enum WorkerStatus { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE' }
```

---

## Constants

- Module-scoped constants: `SCREAMING_SNAKE_CASE`
- Always prefix with the domain — never a bare noun

```typescript
// ❌
const MAX = 3;
const TTL = 1800;
const CONFIG = { ... };

// ✅
const MAX_STRIKE_COUNT = 3;
const OTP_TTL_SECONDS = 1800;
const JWT_CONFIG = { ... };
```

---

## Quick-reference: common offenders

| ❌ Ambiguous | ✅ Clear replacement |
|---|---|
| `data` | `workerProfile`, `bookingList`, `psgcBarangays` |
| `result` | `createdBooking`, `otpVerifyResult`, `paginatedWorkers` |
| `temp` | `expiresAt`, `pendingBookingId`, `cachedToken` |
| `handler` | `resolveNoShow`, `expireBooking`, `handleOtpVerified` |
| `helper` | extract into a named function: `formatPhoneNumber`, `buildStrikePayload` |
| `flag` | `isVerified`, `hasExpired`, `canAcceptBookings` |
| `info` | `workerContactInfo`, `barangayDetails`, `reviewMeta` |
| `cb` | `onSuccess`, `onExpire`, `transformFn` |
| `mgr` | write it out: `bookingManager` → better: `bookingCoordinator` |
