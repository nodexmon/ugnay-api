# UGNAY API — Project Status Report

| Field | Value |
|---|---|
| **Date** | July 23, 2026 |
| **BRD Version** | 1.5 (System hardening pass) |
| **Branch** | `main` |
| **Test Status** | 369 / 369 passing (49 suites) |

---

## Git

| Item | Value |
|---|---|
| Current branch | `main` |
| Working tree | Clean |
| BRD v1.5 hardening | Merged to `main` |

---

## Tests

| | Count |
|---|---|
| Test suites | 49 |
| Tests passing | **369 / 369** |
| Tests failing | 0 |
| Unit spec files | 48 (`src/**/*.spec.ts`) |
| E2E spec files | 7 (`test/**/*.e2e-spec.ts`) |
| Source `.ts` files (non-generated) | 179 |

> Unit tests mock the Prisma client (`test/prisma-client.mock.ts`) — no DB needed.
> E2E suites require the test Postgres (`docker-compose.test.yml`, port 5433); run in CI or on a docker-equipped machine before merging.

---

## Architecture

**Domain modules (10):** admin, auth, barangays, bookings, categories, customers, notifications, reviews, users, workers — plus root `AppController` (health) and `UploadsModule`.

**Schema:** 17 Prisma models · 12 enums · 21 applied migrations

**Controllers:** all routes protected by global `JwtAuthGuard` + `CaslGuard` + `ThrottlerGuard`; bypass with `@Public()` / `@SkipAbilityCheck()`.

**Background jobs (cron):**

| Cron | Schedule | Purpose |
|---|---|---|
| `BookingsCron.expiredPendingBookings` | every minute | Expire PENDING bookings past 30-min window; push to customer (BKG-09) |
| `BookingsCron.cancelStaleAcceptedBookings` | hourly | Auto-cancel ACCEPTED bookings never started 24h past window end (BKG-11) |
| `NotificationsCron.checkPushReceipts` | every 15 min | Poll Expo receipts, prune `DeviceNotRegistered` tokens, age out tickets >24h |
| `AuthCron.purgeExpiredAuthRecords` | daily 02:00 PHT | Purge OTPs >24h and revoked/expired refresh tokens >30d |

### Prisma Models

| Model | Purpose |
|---|---|
| `User` | Auth identity; holds `status`, `role`, `deletedAt` |
| `OtpRequest` | OTP lifecycle; bcrypt-hashed code, per-phone rate limit, 5-attempt cap |
| `RefreshToken` | Hashed refresh tokens; family revocation on reuse |
| `CustomerProfile` | Customer-side profile 1:1 with `User` |
| `WorkerProfile` | Worker-side profile; `status`, `strikeCount`, `averageRating`, `rankingScore` |
| `WorkerCategory` | Worker ↔ ServiceCategory join with optional `rateOverride` |
| `WorkerServiceArea` | Worker ↔ Barangay join for service coverage |
| `VerificationDoc` | ID/selfie submissions for worker verification |
| `WorkerCredential` | Professional credentials (license, certification, training) |
| `Barangay` | Municipality barangays; PSGC-synced |
| `ServiceCategory` | Service types; 8 seeded at launch |
| `Booking` | Core booking record; full state machine |
| `Review` | 1:1 with completed bookings; drives `averageRating`/`rankingScore` denorm |
| `NoShowReport` | Worker or customer no-show reports pending admin review |
| `Strike` | Strike record linked to worker and optional booking |
| `PushToken` | Expo push tokens per user per platform |
| `PushTicket` | Persisted Expo push tickets for receipt polling |

---

## BRD v1.5 Coverage

### Implemented & verified in code

| Requirement | BRD Ref | Evidence |
|---|---|---|
| Phone OTP auth, rate limit 5/hr | AUTH-05 | `otp.service.ts` `createOtp` `$transaction` |
| OTP codes bcrypt-hashed (cost 10) | AUTH-05 | `otp.service.ts:26` (migration `..._hash_otp_codes_add_attempts`) |
| E.164 PH phone validation | AUTH-06 | `@Matches(/^\+63\d{10}$/)` on OTP DTOs |
| OTP 5-attempt cap, DB-enforced, generic 401 | AUTH-10 | `otp.service.ts` atomic `updateMany` attempts guard |
| Refresh-token reuse → family revocation + warn log | AUTH-11 | `auth.service.ts:110` |
| Suspended-account refresh rejection | AUTH-07 | `assertUserCanAuthenticate` in refresh path |
| Two-step registration (registrationToken) | AUTH-09 | `auth.service.ts` `verifyOtp`/`register` |
| Worker verification flow + 2nd-rejection SUSPENDED | WRK-05 | `admin.service.ts:128` |
| Admin reinstatement w/ audit note, strike reset | WRK-05 / BR-06 | `PATCH /admin/workers/:id/reinstate` |
| 3-strike auto-suspend | BR-06 | `strike.util.ts:35` |
| Worker credentials upload + admin review | WRK-07 | `POST /workers/credentials`, `GET/PATCH /admin/credentials` |
| agreedRate auto-snapshot | BR-13 | booking creation from `rateOverride`/`baseRate` |
| Booking type derived server-side (PST) | BKG-01 / BR-11 | server-side PST arithmetic |
| Concurrent booking guard (one active/worker) | BKG-10 | partial unique index + P2002 catch |
| Booking expiry cron (30 min) + push | BKG-09 | `BookingsCron.expiredPendingBookings` |
| System auto-cancel stale ACCEPTED (24h, no strike) | BKG-11 | `BookingsCron.cancelStaleAcceptedBookings` |
| Customer & worker no-show flows | BKG-06 / BKG-08 | `report-no-show` / `report-customer-no-show` |
| averageRating masked (null) when reviews < 3 | REV-04 | search + public profile |
| rankingScore denorm on review write & delete | REV-04 | `rating.util.ts` in reviews + admin services |
| Admin review deletion + rating recalc | REV-03 | `DELETE /admin/reviews/:id` |
| Push ticket persistence, receipt poll, token prune | Notifications NFR | `NotificationsCron`, `PushTicket` |
| DB-record-based file access control | File Access NFR | `uploads.assertions.ts` |
| Auth-record retention purge (daily 02:00 PHT) | Data Retention NFR | `AuthCron.purgeExpiredAuthRecords` |
| SMS fail-fast 503 + quota credit restore | Risk register | `sms.service.ts:48`, `auth.service.ts:46` |
| `GET /health` (200 / 503) | §9.8 | `app.controller.ts` + `app.service.ts` |
| PSGC barangay sync | §9.7 | `POST /admin/barangays/sync` |

### Acknowledged Post-MVP Gaps (intentionally not built)

| Gap | BRD Ref |
|---|---|
| Worker-to-customer reviews | REV-05 |
| Automated review-bombing detection | REV-06 |
| `DELETE /users` soft-delete endpoint (field ready) | BRD §8.3 |
| Formal audit log table | BRD §8.3 |
| `IN_PROGRESS` auto-timeout | BRD §3.2 |
| Online payment / escrow | BRD §3.2 |
| Real-time GPS tracking | BRD §3.2 |
| Portfolio photo uploads | BRD §3.2 |
| In-app chat / messaging | BRD §3.2 |
| Multi-municipality expansion | BRD §3.2 |
| Automated no-show SMS fallback (no push token) | BKG-02 |
| Orphan upload file sweep utility | Risk register |

---

## Code Health

| Signal | Status |
|---|---|
| `TODO` / `FIXME` / `HACK` in `src/` | None |
| Lint errors | 0 (pre-commit hook auto-fixes) |
| Unit tests | 369 / 369 green |

---

## Action Items

1. **Run E2E suite** — `docker-compose.test.yml` + `pnpm test:e2e` on a docker-equipped machine; confirm the v1.5 crons (BKG-11, receipt polling, retention purge) have integration coverage.
2. **Pre-launch ops** — configure daily backup of the upload directory (ID photos/selfies) before go-live; verify `ADMIN_PHONE` seeding on staging.
3. **Branch cleanup** — prune stale local branches confirmed merged to `main`.
</content>
</invoke>
