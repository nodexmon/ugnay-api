# UGNAY — Business Requirements Document
**MVP v1.0 | Confidential**

> **UGNAY** — *Hanap. Ugnay. Gawa.*
> Local Services Marketplace — MVP
> *Connecting Filipino communities with trusted local workers*

| Field | Value |
|---|---|
| **Version** | 1.3 — MVP (Gap-resolution pass, 2026-07-20) |
| **Status** | Current |
| **Date** | July 2026 |
| **Scope** | Single municipality — Phase 1 validation |
| **Stack** | NestJS · PostgreSQL · Prisma · React Native · Expo · Docker |

---

## 1. Executive Summary

UGNAY is a mobile marketplace application that connects residents of a single municipality with verified, independent local workers across skilled trades and home services. The platform addresses a problem familiar to most Filipino households — needing help around the house but not knowing who to call or trust. UGNAY, the Filipino word for connection, reflects the platform's core purpose: linking people who need help with the people who have the skills to provide it.

The MVP is scoped to validate the core booking loop — worker supply, customer demand, and community trust — before investing in advanced features. Cash payment is the only settlement method at launch, eliminating payment infrastructure complexity and matching the existing behavior of the target market.

> **Brand Alignment Note:** The UGNAY brand vision describes a broader long-term platform, including in-app messaging, portfolio galleries, and AI-assisted worker matching. These are intentionally excluded from MVP scope (see Section 3.2) to protect delivery speed. They remain validated Phase 2 candidates once the core booking loop proves demand.

### 1.1 Problem Statement

| Customer Pain | Worker Pain |
|---|---|
| No reliable way to find vetted local workers | No digital presence or booking system |
| No visibility into worker reputation or rates | Rely entirely on word-of-mouth for new clients |
| No structured way to request or schedule work | No protection against customer no-shows |
| Fear of dealing with unknown, unverified strangers | No system to build and display their reputation |

### 1.2 Proposed Solution

A mobile-first two-sided marketplace with verified worker profiles, a structured booking lifecycle, a transparent ratings system, and admin-managed trust enforcement — all scoped to one municipality for initial traction.

### 1.3 Success Metrics — MVP

| Metric | Target (60 days) | Target (90 days) |
|---|---|---|
| Verified workers onboarded | **30** | **75** |
| Registered customers | **100** | **300** |
| Completed bookings | **50** | **200** |
| Booking completion rate | **≥ 70%** | **≥ 75%** |
| Average worker rating | **≥ 4.0** | **≥ 4.2** |

---

## 2. Stakeholders & User Personas

### 2.1 Stakeholders

| Stakeholder | Role | Primary Interest |
|---|---|---|
| Solo Developer / CTO | Builder & Operator | Ship MVP fast, validate market, minimize complexity |
| Customers | Demand Side | Find trusted workers quickly and affordably |
| Independent Workers | Supply Side | Get more clients, manage bookings, build reputation |
| Admin | Trust Operator | Verify workers, maintain platform quality, handle disputes |

### 2.2 User Personas

#### Persona A — The Customer

| Field | Detail |
|---|---|
| **Name** | Maria, 38 — homeowner, working professional |
| **Goal** | Book a reliable electrician for the weekend without asking neighbors |
| **Frustration** | Doesn't know who to trust, hates price uncertainty, has been stood up before |
| **Behavior** | Checks reviews before buying anything online, mobile-first, WhatsApp user |

#### Persona B — The Worker

| Field | Detail |
|---|---|
| **Name** | Rodel, 45 — freelance electrician, 15 years experience |
| **Goal** | Steady stream of local jobs without depending on referrals |
| **Frustration** | Customers haggle on agreed rates; hard to build a reputation beyond word-of-mouth |
| **Behavior** | Facebook Marketplace user, has smartphone, not tech-savvy — needs simple UX |

---

## 3. Project Scope

### 3.1 In Scope — MVP

> The following features constitute the minimum viable product. Nothing else ships until these are validated.

**Customer Features**
- Phone number registration and login (OTP)
- Browse service categories
- Search and filter workers by category and barangay
- View worker profile: bio, categories, rate, barangay, rating, review count
- View worker availability status (online / offline)
- Request immediate or scheduled bookings (up to 7 days ahead)
- Pin service location on a map
- View confirmed rate before submitting a booking request
- Track booking status in real time
- Cancel a booking (before or after acceptance — see BKG-05)
- Leave a rating (1–5 stars) and written review after job completion
- Report no-shows

**Worker Features**
- Phone number registration and login (OTP)
- Create profile: name, bio, categories (at least 1, up to 3), base rate, barangay
- Upload government-issued ID and selfie for verification
- Optionally upload professional credentials (license, certification, training certificate)
- Toggle availability status (online / offline)
- Set service radius (barangay-based, 1–5 barangays)
- Set own rates per service category
- Receive and respond to booking requests (accept / reject)
- Mark bookings as completed
- View own ratings and reviews
- View own strikes
- Report customer no-shows

**Admin Features**
- Review worker verification applications (ID + selfie)
- Approve or reject worker accounts
- Review professional credential submissions
- Manage service categories
- View and handle worker no-show reports
- View and handle customer no-show reports
- Issue strikes to workers
- Suspend or reinstate user accounts
- Delete abusive or fake reviews

### 3.2 Out of Scope — Post-MVP

| Feature | Reason Deferred |
|---|---|
| Online payment / escrow | Cash validation first; adds PCI complexity |
| Real-time GPS worker tracking | Background location complexity; privacy risks |
| Portfolio photo uploads | Not a primary booking driver at MVP scale |
| In-app chat / messaging | Phone call post-acceptance handles this |
| Worker earnings dashboard | Cash payment — no digital transaction data |
| Multi-municipality expansion | Validate single market first |
| Promotional / discount system | Premature without proven demand |
| Hourly slot scheduling grid | Time window (AM/PM/EVE) is sufficient for MVP |
| Automated review-bombing detection | Admin manual monitoring sufficient at MVP scale |
| Worker-to-customer reviews | Supply-side accountability deferred; admin suspension is the MVP path |
| Audit log table | Timestamp fields on each record serve as lightweight audit trail at MVP |
| IN_PROGRESS auto-timeout | Admin manual resolution is sufficient at MVP scale |

---

## 4. Functional Requirements

### 4.1 Authentication

| ID | Requirement | Description |
|---|---|---|
| AUTH-01 | Phone OTP login | All users authenticate via mobile number. OTP delivered by SMS. Session managed with JWT. |
| AUTH-02 | Role assignment | Users are assigned one role at registration: CUSTOMER, WORKER, or ADMIN. |
| AUTH-03 | Token refresh | Access token valid 15 minutes. Refresh token valid 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`). |
| AUTH-04 | Worker gating | Worker app features locked until account status is VERIFIED. |
| AUTH-05 | OTP rate limiting | A phone number may request at most 5 OTPs per hour. Requests beyond this limit return HTTP 429. Prevents SMS cost abuse and brute-force attacks. |
| AUTH-06 | Phone number format | The API accepts only valid Philippine mobile numbers in E.164 format (`+63XXXXXXXXXX`). Non-conforming numbers are rejected at the validation layer. |
| AUTH-07 | Suspended session behaviour | When a user account is suspended, existing JWTs remain valid until expiry (max 15 minutes). The refresh endpoint checks account status and immediately rejects refresh requests from suspended accounts. |
| AUTH-08 | Admin account provisioning | The initial admin account is created via the seed script (`pnpm db:seed`). No self-registration path exists for the ADMIN role. Additional admins are created by an existing admin via a privileged internal endpoint (not exposed to the public API). |

### 4.2 Worker Onboarding & Verification

| ID | Requirement | Description |
|---|---|---|
| WRK-01 | Profile creation | Worker provides: full name, bio, **at least 1 and up to 3** service categories, base rate, home barangay. |
| WRK-02 | ID upload | Worker uploads a photo of a government-issued ID (UMID, PhilHealth, Driver's License, Passport). Accepted MIME types: `image/jpeg`, `image/png`. Maximum file size: 5 MB. MIME type is validated on upload; extension alone is not trusted. |
| WRK-03 | Selfie upload | Worker uploads a selfie for facial comparison against the ID photo. Same file constraints as WRK-02. |
| WRK-04 | Admin review | Admin manually reviews ID + selfie. Approves or rejects with a reason. Target SLA: 24 hours. The worker receives a push notification when the review is complete. If the worker has no registered push token, no fallback is sent at MVP. |
| WRK-05 | Status flow | Worker status transitions: `PENDING → VERIFIED` (or `REJECTED`). A rejected worker may reapply once with corrected documents. A second rejection sets `WorkerStatus` to `SUSPENDED` — the worker cannot reapply through the normal flow. Admin may manually reinstate a permanently banned worker via a privileged action that requires a written audit note. Status diagram: `PENDING → VERIFIED`, `PENDING → REJECTED`, `REJECTED → PENDING (reapply)`, `REJECTED (2nd) → SUSPENDED (permanent)`. |
| WRK-06 | Service radius | Worker selects barangays they are willing to serve. Minimum 1, maximum 5. |
| WRK-07 | Professional credentials | Workers may optionally upload supporting credentials (type: LICENSE, CERTIFICATION, or TRAINING) after profile creation. Each file follows the same MIME/size constraints as WRK-02. Credentials enter an admin review queue independent of the identity verification queue. Credential status does not block worker availability — VERIFIED status is determined solely by identity verification (WRK-04). |
| WRK-08 | Service area updates | A VERIFIED worker may update their service areas (add/remove barangays) at any time within the 1–5 limit. The change takes effect immediately. |

### 4.3 Booking Lifecycle

> Core state machine: `PENDING → ACCEPTED → IN_PROGRESS → COMPLETED | CANCELLED | CUSTOMER_NO_SHOW`
> Also: `PENDING → EXPIRED | REJECTED | CANCELLED`, `ACCEPTED → CANCELLED`

| ID | Requirement | Description |
|---|---|---|
| BKG-01 | Booking request | Customer submits: worker ID, service type, location pin, preferred date, time window (Morning 6–12 / Afternoon 12–18 / Evening 18–21), and optional notes. The `scheduledDate` must be today or within 7 calendar days — past dates are rejected (HTTP 422). A booking whose `scheduledDate` is the current calendar day is automatically assigned `BookingType.IMMEDIATE` by the server; clients cannot override this. There is no minimum lead time for IMMEDIATE bookings. |
| BKG-02 | Worker notification | Worker receives push notification on new request. Worker must respond within 30 minutes or the request auto-expires. If the worker has no registered push token, the booking remains PENDING until it expires — no SMS fallback is sent at MVP. |
| BKG-03 | Accept / reject | Worker accepts (phone number revealed to customer) or rejects (customer notified, may rebook the same worker or a different one — no lockout period). |
| BKG-04 | Job completion | Worker marks booking as IN_PROGRESS on arrival, then COMPLETED after service. Customer receives prompt to leave a review. There is no server-enforced timeout for the IN_PROGRESS state; admin may manually resolve a stale booking. |
| BKG-05 | Cancellation | Customer may cancel a booking at any time before the worker marks it IN_PROGRESS. The cancellation is immediate — no worker acknowledgement is required. The worker receives a push notification after the fact. Post-acceptance customer cancellations do not trigger a strike against the worker. `cancellationActor` is set to `CUSTOMER`; `cancellationReason` (optional, ≤ 300 chars) is stored. Worker cancellation after acceptance issues a strike and requires a `cancellationReason` (mandatory). |
| BKG-06 | Worker no-show report | Customer can report a worker no-show within 2 hours of the **end** of the booking's time window (e.g., MORNING ends at 12:00 → deadline is 14:00). Triggers admin review and potential worker strike. |
| BKG-07 | One booking per worker | A worker with an ACCEPTED or IN_PROGRESS booking cannot appear as available to other customers until the booking is resolved. |
| BKG-08 | Customer no-show report | A worker may report a customer no-show within 2 hours of the **end** of the booking's time window. The report enters the admin review queue. On confirmation, the booking is marked `CUSTOMER_NO_SHOW` and the event is logged. No automated penalty is applied to the customer at MVP — admin may suspend the account manually using the existing suspension flow. |
| BKG-09 | Expiry notification | When a PENDING booking expires (30-minute timeout), the customer receives a push notification informing them the request has expired and they may rebook. |
| BKG-10 | Concurrent booking guard | The server enforces that a worker cannot have more than one booking in PENDING, ACCEPTED, or IN_PROGRESS state simultaneously. A booking request targeting an already-active worker is rejected at the application layer (HTTP 422) before any DB write. |

### 4.4 Ratings & Reviews

| ID | Requirement | Description |
|---|---|---|
| REV-01 | Review eligibility | Only customers with a COMPLETED booking for that worker may leave a review. |
| REV-02 | Rating scale | 1–5 star rating (integer) plus optional written review up to 500 characters. |
| REV-03 | One review per booking | A customer may submit exactly one review per completed booking. Reviews cannot be edited by the customer. Admin may delete any review (e.g., abusive content, confirmed fake). Deletion triggers a recalculation of the worker's `averageRating` and `totalReviews`. |
| REV-04 | Worker rating display | Worker profile shows average rating and total review count. Minimum 3 reviews before average is displayed publicly. The server returns `null` for `averageRating` on public endpoints when `totalReviews < 3`. The own-profile endpoint always returns the raw value. |
| REV-05 | Worker-to-customer reviews | Workers cannot review customers at MVP. Acknowledged as a known gap — supply-side accountability via reviews is post-MVP. Admin suspension is the current path for problematic customers. |
| REV-06 | Review bombing | No automated detection at MVP. Admin monitors review velocity manually. Accounts exhibiting suspicious patterns may be suspended under the existing admin suspension flow. |

---

## 5. Non-Functional Requirements

| Category | Requirement | Notes |
|---|---|---|
| Performance | API response < 500ms (p95) | At expected load of < 1,000 users on single VPS |
| Availability | 99% uptime target | ~7 hours downtime/month acceptable for MVP |
| Security | JWT auth, HTTPS only, rate limiting | Phone numbers hidden until booking acceptance |
| Data Privacy | Worker address stored as barangay only | No GPS coordinates stored permanently |
| Scalability | Not a priority for MVP | Single VPS, monolithic architecture is intentional |
| Mobile | iOS and Android support | React Native + Expo handles both platforms |
| Notifications | Push via Expo Push API | Booking events require < 30-second delivery |
| Admin Access | Web-based admin dashboard | Simple React or NestJS admin UI — not mobile |
| File Upload Security | MIME type validated server-side | Extension alone is not trusted; max 5 MB per file |

---

## 6. Business Rules

| Rule | Definition |
|---|---|
| BR-01 | One booking equals one worker. Customers cannot split a job across multiple workers in a single booking. |
| BR-02 | Worker phone numbers are hidden until a booking is accepted. After acceptance, the customer sees the worker's number. Once revealed, the number is not hidden again — it remains visible in the booking detail even if the booking is subsequently cancelled. |
| BR-03 | Workers set their own rates. The platform does not enforce minimum or maximum pricing. |
| BR-04 | All payments are made in cash directly between customer and worker. The platform records no financial transactions. |
| BR-05 | A worker must be in VERIFIED status to appear in search results or receive booking requests. |
| BR-06 | Workers accumulate strikes for: post-acceptance cancellation, confirmed no-shows, and validated complaints. At 3 strikes, the account is suspended pending admin review. After admin reviews and reinstates the worker, the strike counter resets to 0. A reinstated worker who accumulates 3 further strikes is suspended again under the same rule. |
| BR-07 | When a worker toggles to online, they become available in **all** of their declared service barangays simultaneously. There is no per-barangay availability toggle. |
| BR-08 | A booking request expires if the worker does not respond within 30 minutes. |
| BR-09 | A worker with an active booking (ACCEPTED or IN_PROGRESS) is automatically hidden from search results. |
| BR-10 | Reviews may only be submitted once per completed booking and cannot be edited or deleted by the customer. Admin may delete reviews. |
| BR-11 | Scheduled bookings may be placed up to 7 calendar days in advance. A booking whose `scheduledDate` is the current calendar day is automatically assigned `BookingType.IMMEDIATE` by the server — clients cannot override this. |
| BR-12 | A worker account rejected during verification may reapply once with corrected documents. A second rejection results in a permanent suspension with no self-service reinstatement path. |
| BR-13 | `agreedRate` is auto-populated at booking creation time by snapshotting the worker's `rateOverride` for the requested category, falling back to the worker's `baseRate` if no override exists. This rate is for reference only — actual payment is negotiated in cash between worker and customer. The field is never updated after booking creation. |
| BR-14 | `cancellationReason` is an optional free-text field (≤ 300 chars) set by the cancelling party. For customer cancellations it captures the customer's reason. For worker post-acceptance cancellations (which issue a strike), providing a reason is required. |

---

## 7. Technical Architecture

### 7.1 System Overview

> Monolithic architecture on a single VPS. One NestJS backend serves both the mobile app and the admin dashboard. Chosen intentionally for solo developer speed and simplicity at MVP scale (<1,000 users).

### 7.2 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| API Server | NestJS (Node.js) | TypeScript, modular, REST-ready, large ecosystem |
| Database | PostgreSQL 17 | Relational integrity, JSON support, battle-tested |
| ORM | Prisma | Type-safe queries, auto-migrations, great DX |
| Mobile | React Native + Expo | iOS + Android from one codebase; OTA updates |
| Push Notifications | Expo Push Notifications | Single API for APNs and FCM; free tier sufficient |
| File Storage | Local VPS disk (MVP) | ID photos and selfies. Migrate to S3-compatible later. Daily backup to separate volume required before launch. |
| Maps | React Native Maps | Location pin selection for service address |
| Auth | JWT + OTP via SMS | Stateless, mobile-friendly; OTP via TextBee SMS |
| Infrastructure | Docker + single VPS | docker-compose: API, PostgreSQL, Nginx, Certbot |

### 7.3 NestJS Module Breakdown

| Module | Responsibilities |
|---|---|
| AuthModule | OTP send/verify (rate-limited), JWT issue/refresh, session management, phone validation (+63 format) |
| UsersModule | User entity, profile reads, role management |
| WorkersModule | Worker profile CRUD, availability toggle, service radius, ID upload, professional credentials upload, worker search (by category/barangay/availability) |
| CustomersModule | Customer profile CRUD |
| CategoriesModule | Service category management (admin-controlled) |
| BarangaysModule | Barangay lookup (seeded from PSGC; read-only at runtime) |
| BookingsModule | Booking lifecycle, state transitions, expiry cron, worker no-show reports, customer no-show reports |
| ReviewsModule | Rating submission, review display, average calculation, admin deletion |
| NotificationsModule | Expo push token registration/removal, send booking event pushes |
| AdminModule | Worker verification queue, credential review queue, strike system, user suspension, PSGC barangay sync, worker no-show management, customer no-show management, review moderation |
| UploadsModule | File upload handling for ID photos, selfies, and credentials; MIME validation; storage abstraction |

---

## 8. Database Schema (Core Entities)

### 8.1 Key Entities

| Entity | Key Fields | Notes |
|---|---|---|
| users | id, phone, role, status, deletedAt | Base entity. Roles: CUSTOMER, WORKER, ADMIN. Status: ACTIVE, SUSPENDED, DELETED. |
| worker_profiles | user_id, bio, base_rate, barangay_id, verification_status | 1:1 with users. Status: PENDING, VERIFIED, REJECTED, SUSPENDED. |
| worker_categories | worker_id, category_id, rate_override | Many-to-many. At least 1, up to 3 categories. Rate override per category optional. |
| worker_service_areas | worker_id, barangay_id | Up to 5 barangays a worker is willing to serve. Updatable post-verification. |
| service_categories | id, name, icon_url, is_active | Admin-managed. Seeded at launch: 8 categories. |
| barangays | id, name, centroid_lat, centroid_lng | Lookup table for municipality barangays. Centroid used for approximate distance. |
| bookings | id, customer_id, worker_id, status, scheduled_date, time_window, location_lat/lng, notes, agreed_rate | Core transactional entity. Status enum drives lifecycle. `agreed_rate` is snapshotted from the worker's category rate at booking creation (see BR-13). |
| reviews | id, booking_id, customer_id, worker_id, rating, comment | 1:1 with bookings. Unique constraint on booking_id. |
| strikes | id, worker_id, reason, booking_id, issued_by | Append-only. `issued_by` is a bare UUID string or the literal `'SYSTEM'` — not a FK relation. Aggregated count triggers suspension at 3. |
| verification_docs | id, worker_id, id_photo_url, selfie_url, reviewed_by, reviewed_at | Admin review record. Stores rejection reason. |
| worker_credentials | id, worker_id, type, file_url, status, rejection_reason | Professional credentials (LICENSE, CERTIFICATION, TRAINING). Reviewed by admin independently of identity verification. |
| push_tokens | id, user_id, token, platform | Expo push tokens. One per device. Updated on login. |
| no_show_reports | id, booking_id, reported_by, description, confirmed, resolved_by, resolved_at | Covers both worker no-shows (reported by customer) and customer no-shows (reported by worker). `reported_by` is a bare UUID string — not a FK relation. |

### 8.2 Booking Status Enum

| Status | Meaning |
|---|---|
| PENDING | Booking request submitted. Worker has 30 minutes to respond. |
| ACCEPTED | Worker accepted. Customer receives worker phone number. |
| REJECTED | Worker rejected. Customer may rebook. |
| IN_PROGRESS | Worker marked arrival. Job is underway. |
| COMPLETED | Worker marked job complete. Review prompt sent to customer. |
| CANCELLED | Cancelled by customer (pre- or post-acceptance) or by worker (strike issued on post-acceptance). |
| EXPIRED | Worker did not respond within 30 minutes. Customer notified by push. |
| NO_SHOW | Admin-confirmed worker no-show. Strike issued. |
| CUSTOMER_NO_SHOW | Admin-confirmed customer no-show. No automated penalty at MVP — admin may suspend account manually. |

### 8.3 Schema Notes

- **`Strike.issuedBy` and `NoShowReport.reportedBy`**: Stored as bare UUID strings (not FK relations) to accommodate system-issued records (e.g., `issuedBy = 'SYSTEM'` for auto-strikes). The application layer ensures valid user IDs on admin-issued records.
- **`UserStatus.DELETED` and `deletedAt`**: The `DELETED` status marks an account as inactive. A `deletedAt` timestamp is stored on the `users` table to support future data retention policies. No hard-delete is performed at MVP.
- **`agreedRate`**: Snapshotted at booking creation from the worker's category-specific rate override, falling back to `baseRate`. Never updated after creation. See BR-13.
- **`cancellationReason`**: Set by the cancelling party. Optional for customer cancellations; required for worker post-acceptance cancellations. See BR-14.
- **Audit log**: Admin actions (approvals, rejections, strikes, suspensions) are not stored in a dedicated audit table at MVP. Timestamp fields on each affected record (`reviewedAt`, `cancelledAt`, etc.) serve as the lightweight audit trail. A formal audit log is a post-MVP item.

---

## 9. REST API Design

> **Global convention:** All list endpoints return a paginated envelope: `{ items: T[], total: number, skip: number, take: number }`. Callers pass `?skip=0&take=20` query params. This applies to all endpoints documented below as paginated, including `/workers/search`.

### 9.1 Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /auth/request-otp | Send OTP to phone number (rate-limited: 5/hour per phone) |
| **POST** | /auth/verify-otp | Verify OTP, return JWT access + refresh tokens |
| **POST** | /auth/refresh | Exchange refresh token for new access token (checks account status) |
| **GET** | /auth/sessions | List all active sessions for the authenticated user |
| **DELETE** | /auth/sessions/:tokenId | Revoke a specific session by token ID |
| **DELETE** | /auth/sessions | Revoke all active sessions |

### 9.2 Worker Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **GET** | /workers/search | Search workers by category, barangay, availability (public, paginated) |
| **GET** | /workers/profile | Get authenticated worker's own profile |
| **GET** | /workers/:id | Get worker public profile (public) |
| **POST** | /workers/profile | Create worker profile |
| **PATCH** | /workers/profile | Update worker profile fields |
| **PATCH** | /workers/availability | Toggle online/offline status |
| **POST** | /workers/verification | Submit ID + selfie for verification (multipart/form-data) |
| **GET** | /workers/verification | Get authenticated worker's own verification status and latest submission details |
| **POST** | /workers/credentials | Upload a professional credential file (LICENSE, CERTIFICATION, TRAINING) |
| **GET** | /workers/strikes | Get authenticated worker's own strike list and current count |

### 9.3 Booking Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /bookings | Create booking request (`agreedRate` auto-populated server-side) |
| **GET** | /bookings | List bookings for authenticated user (customer or worker, paginated) |
| **GET** | /bookings/:id | Get booking details |
| **PATCH** | /bookings/:id/accept | Worker accepts booking request |
| **PATCH** | /bookings/:id/reject | Worker rejects booking request |
| **PATCH** | /bookings/:id/start | Worker marks job as IN_PROGRESS |
| **PATCH** | /bookings/:id/complete | Worker marks job as COMPLETED |
| **PATCH** | /bookings/:id/cancel | Cancel booking (rules enforced server-side per BKG-05) |
| **PATCH** | /bookings/:id | Update a PENDING booking (description, date, time window) |
| **PATCH** | /bookings/:id/report-no-show | Customer reports worker no-show (BKG-06) |
| **PATCH** | /bookings/:id/report-customer-no-show | Worker reports customer no-show (BKG-08) |

### 9.4 Review Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /reviews | Submit rating + review for a completed booking |
| **GET** | /reviews/my | List reviews submitted by the authenticated customer (paginated) |
| **GET** | /reviews/worker/:id | Get paginated reviews for a worker (public) |

### 9.5 User & Customer Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **GET** | /users/me | Get the authenticated user's own record |
| **GET** | /customers/profile | Get the authenticated customer's profile |
| **POST** | /customers/profile | Create customer profile |
| **PATCH** | /customers/profile | Update customer profile |

### 9.6 Category & Barangay Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **GET** | /categories | List active service categories (public) |
| **GET** | /categories/admin | List all categories including inactive (admin only) |
| **POST** | /categories | Create a service category (admin only) |
| **PATCH** | /categories/:id | Update a service category (admin only) |
| **DELETE** | /categories/:id | Deactivate a service category (admin only) |
| **GET** | /barangays | List all barangays in the municipality (public) |

### 9.7 Admin Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **GET** | /admin/users | List users (paginated, filterable by role/status) |
| **GET** | /admin/workers | List worker profiles (paginated, filterable by status) |
| **GET** | /admin/bookings | List bookings (paginated, filterable by status) |
| **GET** | /admin/verifications | List pending verification applications (paginated) |
| **PATCH** | /admin/verifications/:id/approve | Approve worker; set status to VERIFIED; push notification sent to worker |
| **PATCH** | /admin/verifications/:id/reject | Reject worker with reason; push notification sent to worker |
| **GET** | /admin/credentials | List pending credential submissions (paginated) |
| **PATCH** | /admin/credentials/:id/approve | Approve a credential submission |
| **PATCH** | /admin/credentials/:id/reject | Reject a credential submission with reason |
| **POST** | /admin/strikes | Issue manual strike to a worker |
| **PATCH** | /admin/users/:id/suspend | Suspend or reinstate a user account |
| **GET** | /admin/no-shows | List pending worker no-show reports awaiting resolution (paginated) |
| **PATCH** | /admin/no-shows/:id/resolve | Resolve a worker no-show report (confirm or dismiss) |
| **GET** | /admin/customer-no-shows | List pending customer no-show reports awaiting resolution (paginated) |
| **PATCH** | /admin/customer-no-shows/:id/resolve | Resolve a customer no-show report (confirm or dismiss) |
| **GET** | /admin/reviews | List all reviews (paginated, filterable by worker) |
| **DELETE** | /admin/reviews/:id | Delete a review; triggers worker rating recalculation |
| **POST** | /admin/barangays/sync | Sync barangay list from PSGC data source |

### 9.8 Notification Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /notifications/push-token | Register an Expo push token for the authenticated user |
| **DELETE** | /notifications/push-token | Remove an Expo push token |

---

## 10. Mobile Screen Flow

### 10.1 Customer Flow

| # | Screen | Key Actions |
|---|---|---|
| 1 | Onboarding / Login | Enter phone number → receive OTP → verify → register or login |
| 2 | Home — Category Grid | 8 service category cards. Tap to enter search. |
| 3 | Worker List | Filtered workers: name, category, rating, distance, online badge. Scroll list. Empty state shown when no workers match filters. |
| 4 | Worker Profile | Photo, bio, categories, rate, barangay, rating, reviews, Book Now button. |
| 5 | Booking Request Form | Select date (today + 7 days), time window, drop pin on map, add notes. |
| 5a | Booking Confirmation Preview | Shows worker name, confirmed rate (snapshotted `agreedRate`), selected date/time window, and map pin. Customer sees the rate before submitting. Confirm to submit the request. |
| 6 | Booking Status Screen | Live status card: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED. Shows worker number on ACCEPTED. Cancel button visible when status is PENDING or ACCEPTED (pre-IN_PROGRESS). |
| 7 | Review Prompt | Star rating tap + optional comment. Submit once. |
| 8 | Bookings History | List of all past and active bookings. Tap to see details. Empty state shown when no bookings exist. |
| 9 | Cancel Booking | Accessible from Booking Status Screen when status is PENDING or ACCEPTED. Shows confirmation dialog with optional reason field. |

### 10.2 Worker Flow

| # | Screen | Key Actions |
|---|---|---|
| 1 | Login / Register | Same OTP flow. Detects WORKER role post-login. |
| 2 | Profile Setup | Name, bio, categories (at least 1, up to 3), rate, barangay, service areas. |
| 3 | ID Verification | Upload government ID photo + selfie. Status shows PENDING until admin approval. |
| 3a | Verification Rejected | Displayed when `WorkerStatus` is REJECTED. Shows rejection reason from admin. Provides "Resubmit Documents" CTA. CTA is disabled after a second rejection (permanent suspension). |
| 4 | Worker Dashboard | Availability toggle (big, prominent). Active booking card. Earnings note (cash reminder). |
| 5 | Booking Request Alert | Push notification → opens modal with customer details, location, time window, and confirmed rate. Accept or Reject buttons. 30-min timer shown. |
| 6 | Active Booking | Mark Arrived (→ IN_PROGRESS) and Mark Complete buttons. Customer contact visible. Report Customer No-Show button appears after the booking time window ends. |
| 7 | My Reviews | Average star rating, total reviews, scrollable review list. |
| 8 | Report Customer No-Show | Accessible from Active Booking screen after the time window ends. Description field (optional) + Submit button. |

> **Empty and error states:** All list screens (Worker List, Bookings History, My Reviews) must handle: (a) an empty state with an actionable prompt, and (b) a network error state with a retry action. These are not enumerated as separate screens but are required UI states for every list view.

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cold start — no workers at launch | **High** | **Critical** | Pre-onboard 30+ workers before launch. Personally recruit. |
| Workers don't respond to requests fast enough | **High** | **High** | Push notifications + 30-min auto-expiry. Train workers. |
| Cash no-pay by customer post-service | **Medium** | **High** | Review system disincentivizes. No platform recourse at MVP. |
| Fake or fraudulent ID during verification | **Medium** | **Critical** | Manual admin check. Community complaints trigger re-review. |
| Admin verification bottleneck | **High** | **Medium** | Commit to 24-hour SLA. Batch reviews daily. |
| Low review volume reduces trust signals | **High** | **Medium** | Hide average until 3 reviews. Prompt review after every job. |
| VPS downtime during peak booking hours | **Low** | **Medium** | Daily backups. Docker restart policies. Uptime monitoring. |
| Push notification delivery failure | **Medium** | **High** | In-app notification bell as fallback. SMS for critical events. |
| VPS disk failure destroys uploaded ID photos and selfies | **Medium** | **Critical** | Daily backup of upload directory to a separate volume or S3-compatible storage. Must be in place before launch. |
| Race condition: two customers book the same worker simultaneously | **Medium** | **Medium** | Enforce a DB-level check (application guard + active-booking uniqueness constraint per worker) before any booking write. |
| Customer no-shows (worker makes a wasted trip) | **Medium** | **High** | BKG-08 customer no-show report. Admin review mirrors worker no-show flow. Supply-side trust depends on this. |
| Permanent ban admin error | **Low** | **High** | Admin may reinstate via privileged action requiring a written audit note (WRK-05 amendment). |
| Worker has no push token; misses a booking request | **Medium** | **High** | Accepted at MVP. Mitigation: train workers to keep the app installed and notifications enabled. |
| Fake reviews via multiple phone-number accounts | **Medium** | **High** | Admin manual monitoring at MVP. Automated detection is post-MVP. |

---

## 12. Delivery Roadmap

### Phase 1 — Foundation (Weeks 1–3)
- Project scaffolding: NestJS monolith, PostgreSQL, Prisma schema, Docker setup
- Auth module: OTP via SMS (with rate limiting), JWT issue and refresh
- Users, Workers, Categories modules
- Worker onboarding flow: profile creation, ID upload (MIME + size validation)
- Admin dashboard: verification queue, approve/reject; worker notified by push on decision
- Barangay seed data for target municipality
- Admin account seeding via `pnpm db:seed`

### Phase 2 — Core Booking Loop (Weeks 4–6)
- Search module: filter by category, barangay, availability (paginated)
- Bookings module: full state machine, expiry timer, agreedRate auto-snapshot, concurrent booking guard
- Push notifications: booking request, acceptance, cancellation, completion, expiry
- Reviews module: submit, display, average calculation, admin deletion with recalculation
- Strike system: auto-trigger on cancellation and no-show
- Worker no-show flow (BKG-06) and customer no-show flow (BKG-08)

### Phase 3 — Mobile App (Weeks 5–8, parallel with Phase 2)
- Customer screens: home, search, worker profile, booking form, confirmation preview, status tracker (with cancel), review
- Worker screens: dashboard, availability toggle, booking request modal (shows rate), active job, report customer no-show
- Map integration: location pin on booking form
- Notification handling: foreground and background
- Empty and error states on all list screens
- Verification-rejected screen with resubmission CTA

### Phase 4 — Hardening & Launch (Weeks 9–10)
- Security: rate limiting, input validation, HTTPS, file upload MIME sanitization
- Admin dashboard: strikes, suspension, no-show reports (both types), category management, review moderation
- End-to-end testing of booking lifecycle including edge cases
- VPS deployment: Nginx reverse proxy, SSL via Certbot, automated backups
- File upload directory daily backup configured before go-live
- Worker pre-onboarding: manually recruit and verify 30 workers before go-live
- Soft launch: invite-only, 1 barangay first

> **Post-MVP (Validate first):** Portfolio photos · Scheduled booking calendar grid · Online payment / deposit · Real-time GPS · Multi-municipality · In-app chat · Worker-to-customer reviews · Automated review-bombing detection · Formal audit log

---

*© 2026 UGNAY. Internal use only.*
