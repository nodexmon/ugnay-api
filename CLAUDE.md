# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm start:dev          # Run in watch mode
pnpm build              # Compile (nest build + tsc-alias for path aliases)
pnpm lint               # ESLint with auto-fix
pnpm test               # Run unit tests (jest)
pnpm test:watch         # Jest in watch mode
pnpm test:e2e           # End-to-end tests
pnpm db:seed            # Seed the database via prisma/seed.ts
```

Run a single test file:
```bash
pnpm jest src/path/to/file.spec.ts
```

## Architecture

UGNAY is a mobile-first two-sided marketplace connecting Filipino households with verified local workers (electricians, plumbers, cleaners, etc.). MVP scope is a single municipality. The API is NestJS (`@nestjs/platform-express`) with **Prisma 7** and PostgreSQL. The package manager is **pnpm**.

### Module layout

```
src/
  app.module.ts          # Root module — registers global guards, config, logger, scheduler
  prisma/                # PrismaModule/PrismaService (global singleton, exported)
  config/                # Typed config factories: app, jwt, upload, database, logger, textbee
  casl/                  # CaslAbilityFactory, CaslGuard, @CheckAbility() decorator
  common/
    decorators/          # @Public(), @CheckAbility(), @CurrentUser()
    pipes/               # VerificationFilesPipe
    types/               # express.d.ts augmentation (req.user)
    utils/               # strike.util.ts (applyStrike — only shared cross-module util)
  modules/
    auth/                # OTP + JWT auth, JwtStrategy, JwtAuthGuard
    users/               # User CRUD
    workers/             # Worker profiles, service areas, verification docs
    customers/           # Customer profiles
    categories/          # ServiceCategory management
    admin/               # Admin-only operations
    bookings/            # Booking lifecycle with @nestjs/schedule cron jobs
    reviews/             # Reviews tied 1:1 to completed bookings
    barangays/           # Barangay listing + PSGC sync
    notifications/       # Push notification delivery (Expo)
  uploads/               # File upload module (Multer)
  generated/prisma/      # Auto-generated Prisma client (do not edit manually)
```

### Global guards

Three guards are registered globally in `AppModule` via `APP_GUARD`:
- **JwtAuthGuard** — applied to every route by default. Bypass with `@Public()`.
- **CaslGuard** — permission-based authorization. Declare requirements with `@CheckAbility(Action, Subject)` from `src/casl/`. Permissions are defined per role in `CaslAbilityFactory`.
- **ThrottlerGuard** — rate limiting.

### Auth flow

Phone-based OTP auth via **TextBee SMS** service (`SmsService`). On success, the API issues a JWT access token and a hashed refresh token stored in `refresh_tokens`. The JWT payload (`AuthJwtPayload`) carries `sub` (userId) and `role`.

### Validation

`main.ts` registers a global `ValidationPipe` with `transform: true, whitelist: true, forbidNonWhitelisted: true`. All DTOs use `class-validator` decorators; config factories use **Zod** for schema validation.

### Config pattern

All config is loaded via `@nestjs/config` typed factories (`registerAs`). Inject them with:
```ts
@Inject(jwtConfig.KEY) private config: ConfigType<typeof jwtConfig>
```

### Database

Prisma schema is at `prisma/schema.prisma`. The generated client outputs to `src/generated/prisma` in CJS format. After changing the schema, run:
```bash
pnpm prisma migrate dev
pnpm prisma generate
```

The Prisma client is a `pg`-adapter-backed instance injected via `PrismaService` from `PrismaModule`.

### Key domain rules (encoded in schema enums)

- Workers go through `PENDING → VERIFIED/REJECTED` verification before accepting bookings.
- Bookings expire 30 minutes after creation if the worker does not respond (`expiresAt` indexed; handled by a cron job in `BookingsModule`).
- Workers accumulate `Strike`s (max 3 visible in `strikeCount`); reasons: `POST_ACCEPT_CANCELLATION`, `NO_SHOW`, `CUSTOMER_COMPLAINT`.
- Reviews are 1:1 with `COMPLETED` bookings.

### Path aliases

`@/` maps to `src/`. The `tsc-alias` step in `pnpm build` rewrites these for the compiled output.

### Testing

Jest uses `ts-jest` in ESM mode. The Prisma client is mocked globally via `moduleNameMapper` pointing to `test/prisma-client.mock.ts` — no real DB is needed for unit tests.

### Module conventions

Every module follows this file layout (add only what it needs):

```
src/modules/[name]/
  [name].module.ts
  [name].controller.ts
  [name].service.ts
  [name].assertions.ts   ← injectable assertions class (validate + throw, module-specific)
  [name].constants.ts    ← module-scoped constants (thresholds, enum maps, sort arrays)
  [name].types.ts        ← only when the module defines its own types/enums
  dto/
    *.dto.ts
```

**Service section dividers** — separate concerns with these comment headers:

```typescript
// ─── Public API ──────────────────────────────────────────────────────────────

// ─── Private: business logic ─────────────────────────────────────────────────
```

**Assertions class pattern** — module-specific guard and finder methods live in `[name].assertions.ts` as an `@Injectable()` class, registered in the module's `providers` array and injected into the service constructor. Two distinct naming conventions apply:

- **`assert*` methods** always return `void`/`Promise<void>` — they validate a condition and throw if it fails. Nothing more.
- **`find*` / `resolve*` methods** fetch an entity, validate its existence (and optionally its state), then return it. Use this form only when the caller needs the returned value — it avoids a second DB fetch.

Services call `this.assertions.assertX(...)` for guards and `const entity = await this.assertions.findX(...)` for finders. In specs, mock the entire class: `{ provide: [Name]Assertions, useValue: { assertX: jest.fn(), findX: jest.fn() } }`.

**Shared assertion utilities** — assertions are module-scoped. The only shared utility is `src/common/utils/strike.util.ts` (`applyStrike`), used as a standalone function to avoid circular DI.

**Notification fire-and-forget** — always use:

```typescript
void this.notifications.sendToUser(userId, msg).catch(() => {});
```

When the userId requires a DB fetch, extract a named private async method and call it with `.catch(() => {})`. Never use the void async IIFE pattern (`void (async () => { ... })()`).

## Skills

Always invoke the project skills defined in `.claude/commands/` for the relevant task:

| Skill | When to use |
|---|---|
| `branch` | Before starting any work — create and checkout a branch first |
| `commit` | After every meaningful, self-contained unit of work |
| `implement` | When implementing any feature or endpoint |
| `refactor` | When refactoring a module or file |
| `write-tests` | When writing or fixing spec files |
| `clean-code` | Apply clean coding principles to everything written or modified |
| `architecture` | Apply architectural rules to keep the codebase modular and layered |
| `migrate` | When changing `prisma/schema.prisma` — schema edit → migrate → generate → update code |
| `pr` | Before opening or marking a PR ready — pre-flight checklist |
| `debug` | When diagnosing a failing test, runtime error, or unexpected behavior |
| `dto` | When writing or modifying any DTO file |
| `seed` | When adding or modifying seed data in `prisma/seed.ts` |
| `add-endpoint` | When adding a new route to an existing controller |
| `add-module` | When creating a brand-new domain module from scratch |
| `add-config` | When adding a new env var or replacing a hardcoded value |
| `e2e-test` | When writing or extending end-to-end tests |
| `add-permission` | When adding a new CASL action, subject, or role grant |
| `add-cron` | When adding a new scheduled background job |
| `paginate` | When implementing a list endpoint that returns `{ items, total, skip, take }` |
| `add-notification` | When sending a push notification from a service method |
| `add-relation` | When adding a new Prisma relation between models |
| `document-endpoint` | When adding Swagger docs to a new endpoint |
| `soft-delete` | When adding soft-delete to a model or querying a soft-deleteable model |
| `fix-migration` | When a migration fails, needs rollback, or schema/DB have drifted |
| `add-index` | When adding a performance index to speed up a query or cron job |
| `add-transaction` | When wrapping multiple Prisma writes in a transaction |
| `upload-file` | When adding an endpoint that accepts file uploads |
| `handle-error` | When deciding which exception type to throw |
| `error-message` | When writing any exception message string — format, phrasing, period |
| `add-enum` | When adding a new Prisma enum to the schema |
| `typescript` | Apply to every TypeScript file written or modified |
| `prisma-query` | When writing or reviewing any Prisma query |
| `add-decorator` | When adding a new custom NestJS decorator |
| `write-script` | When writing a one-off script that needs Prisma outside NestJS |
| `remove-endpoint` | When deleting a route and cleaning up all associated artifacts |
| `security` | After implementing any endpoint — run before committing |
| `naming` | When writing or reviewing any variable, function, class, or type name |

## Dev Log

After every successful commit or feature implementation, append a dated entry to `logs/dev.log`. Use bullet points per change. Separate sessions with `---`. Read the existing file first to preserve prior entries.
