Apply this checklist when writing or extending end-to-end tests.

## Setup

- E2E specs live in `test/e2e/[feature].e2e-spec.ts`.
- Run with `pnpm test:e2e` (requires Docker — start with `docker compose -f docker-compose.test.yml up -d`).
- Config: `jest-e2e.json` with `globalSetup`, `runInBand` — do not run e2e tests in parallel.

## App lifecycle

```typescript
let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();   // from test/e2e/test-app.ts
});

beforeEach(async () => {
  await resetDb(testApp.prisma);     // from test/e2e/db.ts — truncates all tables
  // seed shared fixtures here
});

afterAll(async () => {
  await testApp.close();
});

const server = () => testApp.app.getHttpServer() as App;
```

- `createTestApp()` boots the full `AppModule` with `ThrottlerGuard` overridden to always pass.
- `resetDb()` runs `TRUNCATE ... RESTART IDENTITY CASCADE` — always call it in `beforeEach`, not `afterEach`.

## Auth

```typescript
const token = testApp.mintToken({ sub: user.id, role: Role.CUSTOMER });
// use as:
.set('Authorization', `Bearer ${token}`)
```

- `mintToken` signs a real JWT using the app's `JwtService` — no mocking needed.
- Always create the user in the DB first, then mint a token for that user's ID.

## Fixtures

Use the factory helpers from `test/e2e/db.ts`:

```typescript
const barangay = await createBarangay(testApp.prisma);
const category = await createCategory(testApp.prisma);
const { user, profile } = await createCustomer(testApp.prisma);
const { user: workerUser, profile: workerProfile } = await createWorker(testApp.prisma, barangay.id);
```

- Pass `overrides` to vary status, phone, etc.
- Always create dependencies in FK order: barangay/category → user → profile → booking.

## Making requests

```typescript
import request from 'supertest';
import { App } from 'supertest/types';

const res = await request(server())
  .post('/bookings')
  .set('Authorization', `Bearer ${token}`)
  .send({ ... });

expect(res.status).toBe(201);
expect(res.body.id).toBeDefined();
```

## What to test in every suite

| Case | Expected status |
|---|---|
| Happy path | 200 / 201 |
| Missing auth token | 401 |
| Wrong role | 403 |
| Resource not found | 404 |
| Invalid input (bad UUID, missing field) | 400 |
| Conflict (duplicate, wrong state) | 409 |

## Assert side effects

After mutating requests, query the DB directly to confirm the side effect:

```typescript
const updated = await testApp.prisma.booking.findUnique({ where: { id } });
expect(updated?.status).toBe(BookingStatus.ACCEPTED);
```

Do not rely solely on the HTTP response — it may return stale data.

## State machine tests

Drive the full lifecycle in one `it` block rather than one test per transition:

```typescript
it('customer can complete a booking end to end', async () => {
  // create → accept → start → complete
});
```

This catches state-dependency bugs that isolated transition tests miss.

## Adding new fixtures

If a new model is needed in tests, add a factory function to `test/e2e/db.ts` following the existing pattern (plain `prisma.model.create` with sensible defaults and an `overrides` param).
