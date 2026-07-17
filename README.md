# UGNAY API

Backend API for UGNAY — a mobile-first two-sided marketplace connecting Filipino households with verified local workers (electricians, plumbers, cleaners, etc.). MVP scope covers a single municipality.

## Prerequisites

- Node.js 22+
- pnpm (`npm install -g pnpm`)
- Docker (for local PostgreSQL)

## Quick Start

```bash
# 1. Copy env file and fill in values
cp .env.example .env

# 2. Start the database
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start the dev server
pnpm start:dev
```

API is available at `http://localhost:3000`.
Swagger UI (non-production only) at `http://localhost:3000/api/docs`.

## Scripts

| Script | Description |
|---|---|
| `pnpm start:dev` | Start in watch mode |
| `pnpm start:debug` | Start with Node debugger attached |
| `pnpm build` | Compile (NestJS + tsc-alias for path rewrites) |
| `pnpm lint` | ESLint with auto-fix |
| `pnpm format` | Prettier format all source files |
| `pnpm test` | Run all unit tests |
| `pnpm test:watch` | Jest in watch mode |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm test:e2e` | End-to-end tests (requires `pnpm test:e2e:db`) |
| `pnpm test:e2e:db` | Start E2E test database via Docker |
| `pnpm test:e2e:db:down` | Stop and remove E2E test database |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (production) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:seed` | Seed the database |
| `pnpm prisma:studio` | Open Prisma Studio |

## Environment Variables

Copy `.env.example` to `.env` and fill in each value:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT access tokens |
| `JWT_EXPIRY` | Access token lifetime (e.g. `15m`) |
| `REFRESH_SECRET` | Secret for signing refresh tokens |
| `REFRESH_EXPIRY` | Refresh token lifetime (e.g. `7d`) |
| `TEXTBEE_API_KEY` | TextBee SMS gateway API key |
| `TEXTBEE_DEVICE_ID` | TextBee device ID for OTP delivery |
| `CORS_ORIGIN` | Allowed CORS origin (leave blank to deny all) |
| `PORT` | HTTP port (default: `3000`) |
| `NODE_ENV` | `development` or `production` |

## Testing

```bash
# All unit tests
pnpm test

# Single spec file
pnpm jest src/modules/bookings/bookings.service.spec.ts

# Coverage report
pnpm test:cov
```

Unit tests use a mocked Prisma client — no database required. E2E tests hit a real PostgreSQL instance started via `pnpm test:e2e:db`.

## Database

Prisma schema: `prisma/schema.prisma`
Generated client: `src/generated/prisma/` (do not edit manually)

After changing the schema:
```bash
pnpm db:migrate    # creates and applies the migration
pnpm db:generate   # regenerates the Prisma client
```

## Architecture

NestJS monolith with feature modules:

```
src/modules/
  auth/          OTP + JWT auth, refresh tokens
  users/         User accounts
  workers/       Worker profiles, verification, credentials, availability
  customers/     Customer profiles
  bookings/      Booking lifecycle (create → accept → start → complete/cancel)
  reviews/       Reviews (1:1 with completed bookings)
  admin/         Admin-only operations (verify workers, manage strikes)
  notifications/ Push notification token registration (Expo)
  categories/    Service category management
```

Three guards apply globally: `JwtAuthGuard` (bypass with `@Public()`), `CaslGuard` (declare with `@CheckAbility()`), `ThrottlerGuard`.

See `CLAUDE.md` for full architectural conventions and development guidelines.
