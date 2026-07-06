Apply these architectural rules at all times to keep the codebase modular, layered, and maintainable. When adding or refactoring code, check every rule below.

## Layer boundaries — never cross them
```
Request → Controller → Service → Prisma/External
```
- Controllers only talk to their own module's service. Never import another module's service directly into a controller.
- Services can call other services only if injected through the module system (declared in `providers` or imported via another module).
- Nothing imports from `app.module.ts` or bootstraps the app from within a module.

## Module responsibilities
- One module = one domain concept (`bookings`, `workers`, `auth`, `notifications`).
- A module must not own logic that belongs to another domain. If `BookingsService` is computing worker ratings, that logic belongs in `WorkersService`.
- Shared utilities (guards, decorators, pipes) live in `common/` and are stateless — no Prisma, no business logic.

## Dependencies between modules
- Prefer `@Global()` sparingly — only for true infrastructure modules used everywhere (`PrismaModule`, `NotificationsModule`).
- For cross-module service access, import the provider module: `imports: [WorkersModule]`, not a manual `providers: [WorkersService]`.
- No circular imports. If Module A needs Module B and Module B needs Module A, extract the shared logic into a third module.

## God class prevention
- No service method longer than ~40 lines. If it's longer, break it into private helper methods.
- No service with more than ~8 public methods. If it's growing, consider splitting by sub-domain (e.g. `BookingsQueryService` vs `BookingsCommandService`).
- No constructor with more than 5 injected dependencies. More than that signals the class is doing too much.

## Prisma schema discipline
- Every new Prisma model must map to exactly one owning module/service.
- No other module's service writes to another module's primary table directly. Use the owning service as the interface.
- Migrations are never skipped — every schema change has a migration file.

## Config discipline
- No `process.env` access outside of config factories in `src/config/`.
- No hardcoded environment-specific values (URLs, limits, durations) in services or controllers.

## When adding something new, ask:
1. Which module owns this? Does that module already exist or do I need a new one?
2. Am I crossing a layer boundary?
3. Am I creating a dependency that didn't exist before — is it justified?
4. Does this make any module responsible for more than one domain concept?
