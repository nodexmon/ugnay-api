Apply these project-specific patterns when implementing any feature in this NestJS/Prisma codebase.

## Module structure
- Controller → calls service → returns result. No logic in controllers.
- One service method per use case. If it branches heavily, extract private helper methods.
- New modules must have: `module.ts`, `service.ts`, `controller.ts`, and corresponding spec files.
- Register the module in `app.module.ts` unless it is `@Global()`.

## Auth and guards
- `@CheckAbility(Action, Subject)` + `@CurrentUser()` on the controller handles access. Never duplicate permission checks in the service.
- Mark public routes with `@Public()`. Every route is JWT-protected by default.
- Ownership checks ("this booking belongs to the caller") go in the service, not the controller.

## DTOs and validation
- Every request body and query string needs a DTO with `class-validator` decorators.
- Use `@IsOptional()` only when a field is genuinely optional in the domain.
- Never access raw request properties inside a service.

## Prisma
- All Prisma calls live in the service. No `prisma.*` in controllers or guards.
- Wrap multiple writes in `$transaction`.
- After editing `prisma/schema.prisma`, run `pnpm prisma migrate dev && pnpm prisma generate` before writing code that uses new fields.

## Config
- New environment-backed values go in a typed config factory in `src/config/` using `registerAs` + Zod validation.
- Inject config with `@Inject(myConfig.KEY) private config: ConfigType<typeof myConfig>`.
- Use `import type { ConfigType }` to satisfy `isolatedModules`.

## Module file layout
- Every module gets a `[name].constants.ts` for module-scoped constants (thresholds, enum maps, sort arrays).
- Module-scoped types go in `[name].types.ts` only if the module defines its own types.
- Constants that are hardcoded inline in a service file belong in `[name].constants.ts`.

## Service structure
- Use two section dividers in every service:
  ```
  // ─── Public API ──────────────────────────────────────────────────────────────
  // ─── Private: business logic ─────────────────────────────────────────────────
  ```
- Assertion and finder methods belong in `[name].assertions.ts`, not in the service.

## Assertions class
- Every module has a `[name].assertions.ts` with an `@Injectable()` class registered in the module's `providers`.
- `assert*` methods return `void`/`Promise<void>` — validate and throw only.
- `find*` / `resolve*` methods fetch, validate, and return the entity — use when the caller needs the value.
- Inject into the service and call as `this.assertions.assertX(...)` or `const e = await this.assertions.findX(...)`.

## Shared utilities
- The only cross-module utility is `src/common/utils/strike.util.ts` (`applyStrike`). Check there before writing cross-module logic.
- All other assertion helpers are module-scoped — do not create new shared assert helpers.

## Notifications
- Always fire-and-forget: `void this.notifications.sendToUser(...).catch(() => {})`.
- Never `await` a notification call in the main flow — it must never block or throw.
- When the userId requires a DB fetch first, extract a private async method and call it with `.catch(() => {})`. Never use the void async IIFE pattern.

## Error handling
- Throw NestJS HTTP exceptions from services (`NotFoundException`, `ForbiddenException`, etc.).
- No try/catch around normal Prisma calls — let the global exception filter handle them.
- Wrap only external I/O (file writes, HTTP) in try/catch.

## General
- Path alias `@/` → `src/`. Use it for all imports.
- No `console.log` — use the injected `Logger` from `nestjs-pino`.
- No `any` types.
- No commented-out code.
