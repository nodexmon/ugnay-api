# UGNAY API — Project Status Report

| Field | Value |
|---|---|
| **Date** | July 21, 2026 |
| **BRD Version** | 1.3 |
| **Branch** | `fix/brd-gap-closure-round4` |
| **Test Status** | 278 / 278 passing |

---

## Git

| Item | Value |
|---|---|
| Current branch | `fix/brd-gap-closure-round4` |
| Commits ahead of `main` | 5 (round-4 gap closure, not yet merged) |
| Working tree | Clean |
| Total local branches | 32 |

**Unmerged commits on this branch:**

```
db2f565 chore: update dev log for BRD v1.3 round 4 gap closure
2b82e2f test(brd): add round-4 spec coverage
74dc148 fix(brd): close round-4 gaps — deletedAt, booking guard, reinstate, cancel order
0266a80 chore: fix PostToolUse hook shell and update dev log
f780fd7 fix(bookings): BRD v1.3 gap closure round 3
```

---

## Tests

| | Count |
|---|---|
| Test suites | 44 |
| Tests passing | **278 / 278** |
| Tests failing | 0 |
| Unit spec files | 44 (`src/**/*.spec.ts`) |
| E2E spec files | 6 (`test/**/*.e2e-spec.ts`) |
| Source `.ts` files | 148 |

> E2E suites require a live Postgres instance (`docker-compose.test.yml`). Not run in this session — run before merging if a test DB is available.

---

## Architecture

**Domain modules (10):** admin, auth, barangays, bookings, categories, customers, notifications, reviews, users, workers

**Schema:** 16 Prisma models · 12 enums · 15 applied migrations

**Controllers (10):** one per module — all routes protected by global `JwtAuthGuard` + `CaslGuard` + `ThrottlerGuard`

**Skills library:** 38 `.claude/commands/*.md` files covering the full dev workflow

### Prisma Models

| Model | Purpose |
|---|---|
| `User` | Auth identity; holds `status`, `role`, `deletedAt` |
| `OtpRequest` | OTP lifecycle with per-phone rate limiting |
| `RefreshToken` | Hashed refresh tokens for session management |
| `CustomerProfile` | Customer-side profile 1:1 with `User` |
| `WorkerProfile` | Worker-side profile; tracks `status`, `strikeCount`, `averageRating` |
| `WorkerCategory` | Worker ↔ ServiceCategory join with optional `rateOverride` |
| `WorkerServiceArea` | Worker ↔ Barangay join for service coverage |
| `VerificationDoc` | ID/document submissions for worker verification |
| `WorkerCredential` | Professional credentials (license, certification) |
| `Barangay` | Municipality barangays; PSGC-synced |
| `ServiceCategory` | Service types (plumbing, electrical, etc.) |
| `Booking` | Core booking record; full state machine |
| `Review` | 1:1 with completed bookings; drives `averageRating` denorm |
| `NoShowReport` | Worker or customer no-show reports pending admin review |
| `Strike` | Strike record linked to worker and optional booking |
| `PushToken` | Expo push tokens per user per platform |

---

## BRD v1.3 Coverage

### Implemented

| Requirement | BRD Ref | Notes |
|---|---|---|
| Phone OTP auth with rate limit (5/hr) | AUTH-05 | Inside `createOtp` `$transaction` |
| E.164 PH phone format validation | AUTH-06 | `@Matches(/^\+63\d{10}$/)` on OTP DTOs |
| Worker verification flow (PENDING → VERIFIED/REJECTED/SUSPENDED) | WRK-05 | Second rejection → SUSPENDED |
| Admin worker reinstatement with audit note | WRK-05 / BR-06 | `PATCH /admin/workers/:id/reinstate` |
| Worker credentials upload | WRK-07 | `POST /workers/credentials` |
| agreedRate auto-snapshotted at booking creation | BR-13 | From `rateOverride` or `baseRate` |
| Booking type auto-set to IMMEDIATE for same-day dates (PST) | BKG-01 | Server-side PST arithmetic |
| Past-date booking guard | BKG-01 | `assertScheduledDateIsValid` |
| Concurrent booking guard (one active per worker) | BKG-10 | DB partial unique index + P2002 catch |
| Worker push notification on new booking request | BKG-02 | Fire-and-forget in `create()` |
| Booking auto-expiry cron (30 min) + customer push | BKG-09 | `BookingsCron` every minute, batch 100 |
| Customer cancel on PENDING and ACCEPTED bookings | BKG-05 | Direct cancel; worker notified by push |
| Worker cancel (ACCEPTED/IN_PROGRESS) with mandatory reason | BR-14 | `cancellationReason` required for workers |
| POST_ACCEPT_CANCELLATION strike on worker cancel | BR-06 | Inside cancel `$transaction` with `bookingId` |
| No-show window enforcement (time window end + 2h) | BKG-06/08 | `assertNoShowWindowOpen` |
| Customer no-show report flow | BKG-08 | `PATCH /bookings/:id/report-customer-no-show` |
| averageRating masked (null) when `totalReviews < 3` | REV-04 | Applied on both `search()` and `findPublicProfile()` |
| Admin review deletion with rating recalculation | REV-03 | `DELETE /admin/reviews/:id` |
| Admin credential review (approve/reject) | WRK-07 | `GET/PATCH /admin/credentials` |
| PSGC barangay sync | — | `POST /admin/barangays/sync` |
| `User.deletedAt` field on schema | BRD §8.3 | Migration applied; no hard-delete at MVP |

### Acknowledged Post-MVP Gaps

| Gap | BRD Ref | Disposition |
|---|---|---|
| Worker-to-customer reviews | REV-05 | Explicitly deferred; admin suspension is the MVP path |
| Automated review-bombing detection | REV-06 | Admin manual monitoring sufficient at MVP scale |
| `DELETE /users` soft-delete endpoint | BRD §8.3 | Schema field (`deletedAt`) ready; no endpoint at MVP |
| Formal audit log table | BRD §8.3 | Timestamp fields serve as lightweight trail |
| `IN_PROGRESS` auto-timeout | BRD §3.2 | Admin manual resolution at MVP |
| Online payment / escrow | BRD §3.2 | Cash-first validation strategy |
| Real-time GPS tracking | BRD §3.2 | Privacy + complexity deferred |
| Portfolio photo uploads | BRD §3.2 | Not a primary booking driver at MVP |
| In-app chat / messaging | BRD §3.2 | Phone call post-acceptance handles this |
| Multi-municipality expansion | BRD §3.2 | Single market validation first |
| Automated no-show SMS fallback (no push token) | BKG-02 | Accepted at MVP; train workers to keep app open |

---

## Code Health

| Signal | Status |
|---|---|
| `TODO` / `FIXME` / `HACK` in `src/` | **None** |
| Lint errors | **0** (pre-commit hook auto-fixes on save) |
| Dead code | None identified |
| Shared assertion utilities | Only `strike.util.ts` — all other assertions are module-scoped |

---

## Action Items

1. **Open PR** — `fix/brd-gap-closure-round4` is clean with 278 green tests; ready to merge to `main`.
2. **Run E2E suite** — `docker-compose.test.yml` + `pnpm test:e2e` before final merge to catch integration regressions.
3. **Branch cleanup** — ~30 stale local branches can be deleted after confirming they are merged to `main`.
4. **Seed admin account** — BRD AUTH-08 notes admin provisioning via `pnpm db:seed`; verify seed is up to date before any staging deploy.
