Apply this checklist when adding a new custom NestJS decorator. There are two distinct patterns in this codebase — pick the right one before writing any code.

## Pattern A — Metadata decorator (consumed by a guard or interceptor)

Use when a guard or interceptor needs to read a flag or value off the route handler.

**Real examples:** `@Public()`, `@CheckAbility(action, subject)`

```typescript
// src/common/decorators/my-feature.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const MY_FEATURE_KEY = 'myFeature';
export const MyFeature = (value: string) => SetMetadata(MY_FEATURE_KEY, value);
```

The guard reads it via `Reflector`:

```typescript
// In the guard's canActivate():
const value = this.reflector.getAllAndOverride<string | undefined>(
  MY_FEATURE_KEY,
  [context.getHandler(), context.getClass()],
);
if (!value) return true; // no decorator = no requirement
```

`getAllAndOverride` checks the method first, then the class — so a class-level decorator can be overridden per route.

**Existing consumers:**
- `JwtAuthGuard` reads `IS_PUBLIC_KEY` from `@Public()`
- `CaslGuard` reads `CHECK_ABILITY_KEY` from `@CheckAbility()`

---

## Pattern B — Param decorator (extracts a value from the request)

Use when you need a controller method parameter populated from the request context.

**Real example:** `@CurrentUser()`

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Usage in a controller method parameter:

```typescript
@Get('profile')
getProfile(@CurrentUser() user: AuthJwtPayload) { ... }
```

The `_data` argument is whatever is passed inside the decorator call (e.g., `@CurrentUser('sub')` would set `_data = 'sub'`). Ignore it if your decorator takes no arguments.

---

## Which pattern to use

| Need | Pattern |
|---|---|
| A guard needs to know something about the route | Metadata (A) |
| A controller parameter needs a value from `req.*` | Param (B) |
| New permission requirement | Use existing `@CheckAbility()` — see `/add-permission` |

Do not add a new metadata decorator unless you are also writing or modifying a guard/interceptor that reads it. A metadata key with no consumer is dead code.

---

## File location

```
src/common/decorators/[name].decorator.ts
```

Export the key constant alongside the decorator so guards can import it without a circular dependency:

```typescript
export const MY_KEY = 'myKey';            // imported by the guard
export const MyDecorator = (...) => ...;  // imported by controllers
```

---

## Register (param decorators only)

Param decorators need no registration — NestJS resolves them automatically at the parameter injection site.

Metadata decorators need no registration either, but the **guard that reads them must be registered**. Global guards are already wired in `AppModule` via `APP_GUARD`. If your new decorator is read by an existing global guard, no module changes are needed.

---

## Testing

```typescript
// Metadata decorator — test the guard, not the decorator itself
// The decorator is just SetMetadata; the guard spec covers the consumer logic

// Param decorator — test via a controller spec with a mock ExecutionContext
const ctx = {
  switchToHttp: () => ({ getRequest: () => ({ user: mockUser }) }),
} as unknown as ExecutionContext;
```

---

## Rules

- Always export the metadata key constant from the decorator file — guards import the key, controllers import the decorator.
- Param decorators: `_data` parameter is unused when the decorator takes no arguments — prefix with `_` to satisfy ESLint.
- Never call `createParamDecorator` for something that should be a metadata flag, and vice versa.
- Do not compose decorators with `applyDecorators` unless they always appear together — prefer explicit stacking at the call site.
