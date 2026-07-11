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
  common/
    decorators/          # @Public(), @Roles(...), @CurrentUser()
    pipes/               # VerificationFilesPipe
    types/               # express.d.ts augmentation (req.user)
  modules/
    auth/                # OTP + JWT auth, JwtStrategy, JwtAuthGuard, RolesGuard
    users/               # User CRUD
    workers/             # Worker profiles, service areas, verification docs
    customers/           # Customer profiles
    categories/          # ServiceCategory management
    admin/               # Admin-only operations
    bookings/            # Booking lifecycle with @nestjs/schedule cron jobs
    reviews/             # Reviews tied 1:1 to completed bookings
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

**Assertions class pattern** — module-specific assertion methods (validate + throw) live in `[name].assertions.ts` as an `@Injectable()` class, registered in the module's `providers` array and injected into the service constructor. Services call `this.assertions.assertX(...)`. In specs, mock the entire class: `{ provide: [Name]Assertions, useValue: { assertX: jest.fn() } }`.

**Shared assertion utilities** — cross-module helpers (`assertBookingExists`, `assertWorkerProfileExists`, `assertUserIsActive`) live in `src/common/utils/assert.util.ts` as standalone functions (not injectable — avoids circular DI risk).

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

## Dev Log

After every successful commit or feature implementation, append a dated entry to `logs/dev.log`. Use bullet points per change. Separate sessions with `---`. Read the existing file first to preserve prior entries.
