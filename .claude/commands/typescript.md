Apply these rules to every TypeScript file written or modified. This is the baseline for type discipline in this codebase.

## Import types correctly

Use `import type` for anything that is only needed at compile time:

```typescript
import type { AuthJwtPayload } from '@/modules/auth/auth.types';
import type { AvatarFile } from './uploads.types';
```

Use a regular import when the value is needed at runtime (instantiation, `instanceof`, enum values):

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@/generated/prisma/enums';
```

---

## Never use `any`

`@typescript-eslint/no-explicit-any` is a warning. Treat it as an error in production code.

**In catch blocks — use `unknown`:**
```typescript
// ✅
catch (err: unknown) {
  throw new InternalServerErrorException('Failed to send SMS.');
}

// ❌
catch (err: any) { ... }
```

**In test doubles — use `as unknown as T`:**
```typescript
const ctx = { switchToHttp: jest.fn() } as unknown as ExecutionContext;
```

**Never use `any` to silence a type error.** Fix the types instead.

---

## No non-null assertions

```typescript
// ❌ — hides a potential null/undefined
const id = user!.id;

// ✅ — narrow explicitly
if (!user) throw new NotFoundException('User not found.');
const id = user.id;
```

Non-null assertions (`!`) are prohibited in production code. If a value might be null/undefined, guard it.

---

## `Record<K, V>` over index signatures

```typescript
// ✅
const MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
};

// ❌
const MIME_LABELS: { [key: string]: string } = { ... };
```

---

## `interface` for contracts, `type` for data structures and unions

```typescript
// interface — extensible contract, external API shape
interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface PsgcBarangay {
  code: string;
  name: string;
}

// type — concrete data shape or union
type SignedTokens = { accessToken: string; refreshToken: string };

type VerifyOtpResult =
  | { type: 'login'; accessToken: string; refreshToken: string }
  | { type: 'registration'; registrationToken: string };
```

DTOs are always **classes** (required by class-validator and class-transformer).

---

## Type declarations live in `[name].types.ts`, never in a service

A `*.service.ts` file contains the `@Injectable()` class and its methods — nothing else. Never declare a `type` or `interface` at the top of a service (or a cron, guard, or pipe). Module-owned types belong in the module's `[name].types.ts`, exported and imported back:

```typescript
// ❌ workers.service.ts — type declaration lying around in a service
type WorkerWithRelations = Prisma.WorkerProfileGetPayload<{ include: typeof WORKER_INCLUDE }>;

@Injectable()
export class WorkersService { ... }

// ✅ workers.types.ts
export type WorkerWithRelations = Prisma.WorkerProfileGetPayload<{
  include: typeof WORKER_INCLUDE;
}>;

// ✅ workers.service.ts
import type { WorkerWithRelations } from './workers.types';
```

Include/select **constants** (runtime values) live in `[name].constants.ts` or `common/constants/`; the `GetPayload` types derived from them (via `typeof`) live in `[name].types.ts`.

---

## Discriminated unions for multi-case returns

When a function can return one of several distinct shapes, use a discriminated union:

```typescript
type VerifyOtpResult =
  | { type: 'login'; accessToken: string; refreshToken: string }
  | { type: 'registration'; registrationToken: string };

// Caller narrows with the discriminant:
if (result.type === 'login') {
  return { accessToken: result.accessToken, ... };
}
return { registrationToken: result.registrationToken };
```

Do not return `object | undefined` or widen to a common supertype — model the actual cases.

---

## `as const` for readonly objects

```typescript
// ✅
export const WORKER_INCLUDE = {
  user: { select: { id: true, phone: true } },
} as const;

// ❌
export const WORKER_INCLUDE = { ... };  // mutable, inferred as wide type
```

---

## Annotate public async methods

Return types on public service and assertions methods prevent accidental widening and improve IDE feedback:

```typescript
// ✅ — explicit
async findUserForRefresh(userId: string): Promise<User> { ... }
async sendToUser(userId: string, msg: PushMessage): Promise<void> { ... }

// tolerated on simple inference
async findAll() {
  return this.prisma.barangay.findMany();  // Prisma's return type is precise
}
```

Annotate when: the function is public, the return type isn't obvious from one glance, or the function has multiple return paths.

---

## Type the transaction client

```typescript
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';

// ✅
async (tx: TransactionClient) => { ... }

// ❌
async (tx: any) => { ... }
async (tx) => { ... }  // implicit any in strict mode
```

---

## Enum imports

```typescript
// ✅
import { BookingStatus, Role } from '@/generated/prisma/enums';

// ❌
import { BookingStatus } from '@prisma/client';
```

---

## Type assertions — only when narrowing is provably safe

```typescript
// ✅ — after a runtime check, assertion reflects known type
const payload = this.jwt.verify(token);
if (!payload || typeof payload !== 'object') throw new UnauthorizedException(...);
return payload as AuthJwtPayload & { tokenId: string };

// ✅ — const assertion for literal types
const config = { ... } as const;

// ❌ — assertion to silence a type error without a check
return result as MyType;  // if this requires a thought, fix the types
```

---

## Rules summary

| Rule | Status |
|---|---|
| `import type` for compile-only imports | Required |
| `any` in production code | Prohibited |
| `unknown` in catch blocks | Required |
| Non-null assertions (`!`) | Prohibited |
| `Record<K,V>` over index signatures | Required |
| Annotate public async return types | Required |
| `TransactionClient` typed explicitly | Required |
| Enum imports from `@/generated/prisma/enums` | Required |
| Type assertions without a prior runtime check | Prohibited |
