# UGNAY — Business Requirements Document
**MVP v1.0 | Confidential**

> **UGNAY** — *Hanap. Ugnay. Gawa.*
> Local Services Marketplace — MVP
> *Connecting Filipino communities with trusted local workers*

| Field | Value |
|---|---|
| **Version** | 1.1 — MVP (Rebrand: UGNAY) |
| **Status** | Current (Updated 2026-07-11 against implementation) |
| **Date** | June 2026 |
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
- Track booking status in real time
- Leave a rating (1–5 stars) and written review after job completion
- Report no-shows

**Worker Features**
- Phone number registration and login (OTP)
- Create profile: name, bio, categories (up to 3), base rate, barangay
- Upload government-issued ID and selfie for verification
- Toggle availability status (online / offline)
- Set service radius (barangay-based)
- Set own rates per service category
- Receive and respond to booking requests (accept / reject)
- Mark bookings as completed
- View own ratings and reviews

**Admin Features**
- Review worker verification applications (ID + selfie)
- Approve or reject worker accounts
- Manage service categories
- View and handle no-show reports
- Issue strikes to workers
- Suspend or reinstate user accounts

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

---

## 4. Functional Requirements

### 4.1 Authentication

| ID | Requirement | Description |
|---|---|---|
| AUTH-01 | Phone OTP login | All users authenticate via mobile number. OTP delivered by SMS. Session managed with JWT. |
| AUTH-02 | Role assignment | Users are assigned one role at registration: CUSTOMER, WORKER, or ADMIN. |
| AUTH-03 | Token refresh | Access token valid 15 minutes. Refresh token valid 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`). |
| AUTH-04 | Worker gating | Worker app features locked until account status is VERIFIED. |

### 4.2 Worker Onboarding & Verification

| ID | Requirement | Description |
|---|---|---|
| WRK-01 | Profile creation | Worker provides: full name, bio, up to 3 service categories, base rate, home barangay. |
| WRK-02 | ID upload | Worker uploads a photo of a government-issued ID (UMID, PhilHealth, Driver's License, Passport). |
| WRK-03 | Selfie upload | Worker uploads a selfie for facial comparison against the ID photo. |
| WRK-04 | Admin review | Admin manually reviews ID + selfie. Approves or rejects with a reason. Target SLA: 24 hours. |
| WRK-05 | Status flow | Worker status transitions: PENDING → VERIFIED (or REJECTED). Rejected workers may reapply once with corrected documents. A second rejection results in a permanent ban (account suspended, cannot reapply). Enforced server-side. |
| WRK-06 | Service radius | Worker selects barangays they are willing to serve. Minimum 1, maximum 5. |

### 4.3 Booking Lifecycle

> Core state machine: `PENDING → ACCEPTED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW`

| ID | Requirement | Description |
|---|---|---|
| BKG-01 | Booking request | Customer submits: worker ID, service type, location pin, preferred date, time window (Morning 6–12 / Afternoon 12–18 / Evening 18–21), and optional notes. |
| BKG-02 | Worker notification | Worker receives push notification on new request. Worker must respond within 30 minutes or the request auto-expires. |
| BKG-03 | Accept / reject | Worker accepts (phone number revealed to customer) or rejects (customer notified, can rebook another worker). |
| BKG-04 | Job completion | Worker marks booking as IN_PROGRESS on arrival, then COMPLETED after service. Customer receives prompt to leave a review. |
| BKG-05 | Cancellation | Customer may cancel before acceptance. After acceptance, cancellation requires worker acknowledgement. Worker cancellation after acceptance issues a strike. |
| BKG-06 | No-show report | Customer can report a no-show within 2 hours of the booking window. Triggers admin review and potential worker strike. |
| BKG-07 | One booking per worker | A worker with an ACCEPTED or IN_PROGRESS booking cannot appear as available to other customers until the booking is resolved. |

### 4.4 Ratings & Reviews

| ID | Requirement | Description |
|---|---|---|
| REV-01 | Review eligibility | Only customers with a COMPLETED booking for that worker may leave a review. |
| REV-02 | Rating scale | 1–5 star rating (integer) plus optional written review up to 500 characters. |
| REV-03 | One review per booking | A customer may submit exactly one review per completed booking. Reviews cannot be edited. |
| REV-04 | Worker rating display | Worker profile shows average rating and total review count. Minimum 3 reviews before average is displayed publicly. The API always returns the `averageRating` field; the 3-review threshold is enforced at the UI layer. |

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

---

## 6. Business Rules

| Rule | Definition |
|---|---|
| BR-01 | One booking equals one worker. Customers cannot split a job across multiple workers in a single booking. |
| BR-02 | Worker phone numbers are hidden until a booking is accepted. After acceptance, the customer sees the worker's number. |
| BR-03 | Workers set their own rates. The platform does not enforce minimum or maximum pricing. |
| BR-04 | All payments are made in cash directly between customer and worker. The platform records no financial transactions. |
| BR-05 | A worker must be in VERIFIED status to appear in search results or receive booking requests. |
| BR-06 | Workers accumulate strikes for: post-acceptance cancellation, confirmed no-shows, and validated complaints. At 3 strikes, the account is suspended pending admin review. |
| BR-07 | Workers may only be online (available) in barangays within their declared service radius. |
| BR-08 | A booking request expires if the worker does not respond within 30 minutes. |
| BR-09 | A worker with an active booking (ACCEPTED or IN_PROGRESS) is automatically hidden from search results. |
| BR-10 | Reviews may only be submitted once per completed booking and cannot be edited or deleted by the customer. |
| BR-11 | Scheduled bookings may be placed up to 7 calendar days in advance. Same-day bookings are treated as immediate. |
| BR-12 | A worker account rejected during verification may reapply once with corrected documents. Second rejection results in permanent ban. |

---

## 7. Technical Architecture

### 7.1 System Overview

> Monolithic architecture on a single VPS. One NestJS backend serves both the mobile app and the admin dashboard. Chosen intentionally for solo developer speed and simplicity at MVP scale (<1,000 users).

### 7.2 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| API Server | NestJS (Node.js) | TypeScript, modular, REST-ready, large ecosystem |
| Database | PostgreSQL 16 | Relational integrity, JSON support, battle-tested |
| ORM | Prisma | Type-safe queries, auto-migrations, great DX |
| Mobile | React Native + Expo | iOS + Android from one codebase; OTA updates |
| Push Notifications | Expo Push Notifications | Single API for APNs and FCM; free tier sufficient |
| File Storage | Local VPS disk (MVP) | ID photos and selfies. Migrate to S3-compatible later. |
| Maps | React Native Maps | Location pin selection for service address |
| Auth | JWT + OTP via SMS | Stateless, mobile-friendly; OTP via TextBee SMS |
| Infrastructure | Docker + single VPS | docker-compose: API, PostgreSQL, Nginx, Certbot |

### 7.3 NestJS Module Breakdown

| Module | Responsibilities |
|---|---|
| AuthModule | OTP send/verify, JWT issue/refresh, phone validation |
| UsersModule | User entity, profile reads, role management |
| WorkersModule | Worker profile CRUD, availability toggle, service radius, ID upload, worker search (by category/barangay/availability) |
| CustomersModule | Customer profile CRUD |
| CategoriesModule | Service category management (admin-controlled) |
| BarangaysModule | Barangay lookup (seeded; read-only at runtime) |
| BookingsModule | Booking lifecycle, state transitions, expiry cron, no-show reports |
| ReviewsModule | Rating submission, review display, average calculation |
| NotificationsModule | Expo push token storage, send booking event pushes |
| AdminModule | Worker verification queue, strike system, user suspension, complaint management |
| UploadsModule | File upload handling for ID photos and selfies, storage abstraction |

---

## 8. Database Schema (Core Entities)

### 8.1 Key Entities

| Entity | Key Fields | Notes |
|---|---|---|
| users | id, phone, role, status | Base entity. Roles: CUSTOMER, WORKER, ADMIN. Status: ACTIVE, SUSPENDED, DELETED. |
| worker_profiles | user_id, bio, base_rate, barangay_id, verification_status | 1:1 with users. Status: PENDING, VERIFIED, REJECTED, SUSPENDED. |
| worker_categories | worker_id, category_id, rate_override | Many-to-many. Up to 3 categories. Rate override per category optional. |
| worker_service_areas | worker_id, barangay_id | Up to 5 barangays a worker is willing to serve. |
| service_categories | id, name, icon_url, is_active | Admin-managed. Seeded at launch: 8 categories. |
| barangays | id, name, centroid_lat, centroid_lng | Lookup table for municipality barangays. Centroid used for approximate distance. |
| bookings | id, customer_id, worker_id, status, scheduled_date, time_window, location_lat/lng, notes | Core transactional entity. Status enum drives lifecycle. |
| reviews | id, booking_id, customer_id, worker_id, rating, comment | 1:1 with bookings. Unique constraint on booking_id. |
| strikes | id, worker_id, reason, booking_id, issued_by | Append-only. Aggregated count triggers suspension at 3. |
| verification_docs | id, worker_id, id_photo_url, selfie_url, reviewed_by, reviewed_at | Admin review record. Stores rejection reason. |
| push_tokens | id, user_id, token, platform | Expo push tokens. One per device. Updated on login. |

### 8.2 Booking Status Enum

| Status | Meaning |
|---|---|
| PENDING | Booking request submitted. Worker has 30 minutes to respond. |
| ACCEPTED | Worker accepted. Customer receives worker phone number. |
| IN_PROGRESS | Worker marked arrival. Job is underway. |
| COMPLETED | Worker marked job complete. Review prompt sent to customer. |
| CANCELLED | Cancelled by customer (pre-acceptance) or by worker (strike issued). |
| EXPIRED | Worker did not respond within 30 minutes. |
| NO_SHOW | Admin-confirmed worker no-show. Strike issued. |

---

## 9. REST API Design

### 9.1 Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /auth/request-otp | Send OTP to phone number |
| **POST** | /auth/verify-otp | Verify OTP, return JWT access + refresh tokens |
| **POST** | /auth/refresh | Exchange refresh token for new access token |
| **GET** | /auth/sessions | List all active sessions for the authenticated user |
| **DELETE** | /auth/sessions/:tokenId | Revoke a specific session by token ID |
| **DELETE** | /auth/sessions | Revoke all active sessions |

### 9.2 Worker Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **GET** | /workers/search | Search workers by category, barangay, availability (public) |
| **GET** | /workers/profile | Get authenticated worker's own profile |
| **GET** | /workers/:id | Get worker public profile (public) |
| **POST** | /workers/profile | Create worker profile |
| **PATCH** | /workers/profile | Update worker profile fields |
| **PATCH** | /workers/availability | Toggle online/offline status |
| **POST** | /workers/verification | Submit ID + selfie for verification |

### 9.3 Booking Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | /bookings | Create booking request |
| **GET** | /bookings | List bookings for authenticated user (customer or worker) |
| **GET** | /bookings/:id | Get booking details |
| **PATCH** | /bookings/:id/accept | Worker accepts booking request |
| **PATCH** | /bookings/:id/reject | Worker rejects booking request |
| **PATCH** | /bookings/:id/start | Worker marks job as IN_PROGRESS |
| **PATCH** | /bookings/:id/complete | Worker marks job as COMPLETED |
| **PATCH** | /bookings/:id/cancel | Cancel booking (rules enforced server-side) |
| **PATCH** | /bookings/:id/update | Update a PENDING booking (description, date, time window) |
| **PATCH** | /bookings/:id/report-no-show | Customer reports worker no-show |

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
| **GET** | /admin/verifications | List pending worker verification applications |
| **PATCH** | /admin/verifications/:id/approve | Approve worker; set status to VERIFIED |
| **PATCH** | /admin/verifications/:id/reject | Reject worker with reason |
| **POST** | /admin/strikes | Issue manual strike to a worker |
| **PATCH** | /admin/users/:id/suspend | Suspend or reinstate a user account |
| **GET** | /admin/no-shows | List pending no-show reports awaiting resolution |
| **PATCH** | /admin/no-shows/:id/resolve | Resolve a no-show report (confirm or dismiss) |

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
| 3 | Worker List | Filtered workers: name, category, rating, distance, online badge. Scroll list. |
| 4 | Worker Profile | Photo, bio, categories, rate, barangay, rating, reviews, Book Now button. |
| 5 | Booking Request Form | Select date (today + 7 days), time window, drop pin on map, add notes. Confirm. |
| 6 | Booking Status Screen | Live status card: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED. Shows worker number on ACCEPTED. |
| 7 | Review Prompt | Star rating tap + optional comment. Submit once. |
| 8 | Bookings History | List of all past and active bookings. Tap to see details. |

### 10.2 Worker Flow

| # | Screen | Key Actions |
|---|---|---|
| 1 | Login / Register | Same OTP flow. Detects WORKER role post-login. |
| 2 | Profile Setup | Name, bio, categories (up to 3), rate, barangay, service areas. |
| 3 | ID Verification | Upload government ID photo + selfie. Status shows PENDING until admin approval. |
| 4 | Worker Dashboard | Availability toggle (big, prominent). Active booking card. Earnings note (cash reminder). |
| 5 | Booking Request Alert | Push notification → opens modal with customer details, location, time window. Accept or Reject buttons. 30-min timer shown. |
| 6 | Active Booking | Mark Arrived (→ IN_PROGRESS) and Mark Complete buttons. Customer contact visible. |
| 7 | My Reviews | Average star rating, total reviews, scrollable review list. |

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

---

## 12. Delivery Roadmap

### Phase 1 — Foundation (Weeks 1–3)
- Project scaffolding: NestJS monolith, PostgreSQL, Prisma schema, Docker setup
- Auth module: OTP via SMS, JWT issue and refresh
- Users, Workers, Categories modules
- Worker onboarding flow: profile creation, ID upload
- Admin dashboard: verification queue, approve/reject
- Barangay seed data for target municipality

### Phase 2 — Core Booking Loop (Weeks 4–6)
- Search module: filter by category, barangay, availability
- Bookings module: full state machine, expiry timer
- Push notifications: booking request, acceptance, completion
- Reviews module: submit, display, average calculation
- Strike system: auto-trigger on cancellation and no-show

### Phase 3 — Mobile App (Weeks 5–8, parallel with Phase 2)
- Customer screens: home, search, worker profile, booking form, status tracker, review
- Worker screens: dashboard, availability toggle, booking request modal, active job
- Map integration: location pin on booking form
- Notification handling: foreground and background

### Phase 4 — Hardening & Launch (Weeks 9–10)
- Security: rate limiting, input validation, HTTPS, file upload sanitization
- Admin dashboard: strikes, suspension, no-show reports, category management
- End-to-end testing of booking lifecycle
- VPS deployment: Nginx reverse proxy, SSL via Certbot, automated backups
- Worker pre-onboarding: manually recruit and verify 30 workers before go-live
- Soft launch: invite-only, 1 barangay first

> **Post-MVP (Validate first):** Portfolio photos · Scheduled booking calendar grid · Online payment / deposit · Real-time GPS · Multi-municipality · In-app chat

---

*© 2026 UGNAY. Internal use only.*
