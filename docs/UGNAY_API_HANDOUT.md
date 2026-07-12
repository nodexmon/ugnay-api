# UGNAY — Mobile App API Handout
**For: Mobile Frontend Team | Confidential**

> Base URL (dev): `http://localhost:3000`
> Base URL (prod): TBD — configure via environment variable in the app
> All endpoints are **JSON** (`Content-Type: application/json`) unless marked `multipart/form-data`.

---

## Table of Contents

1. [Authentication & Headers](#1-authentication--headers)
2. [Error Format](#2-error-format)
3. [Enums Reference](#3-enums-reference)
4. [Auth Endpoints](#4-auth-endpoints)
5. [User Endpoints](#5-user-endpoints)
6. [Customer Endpoints](#6-customer-endpoints)
7. [Worker Endpoints](#7-worker-endpoints)
8. [Booking Endpoints](#8-booking-endpoints)
9. [Reviews Endpoints](#9-reviews-endpoints)
10. [Categories & Barangays](#10-categories--barangays)
11. [Notifications (Push Tokens)](#11-notifications-push-tokens)
12. [Booking Lifecycle — State Machine](#12-booking-lifecycle--state-machine)
13. [Typical App Flows](#13-typical-app-flows)

---

## 1. Authentication & Headers

All protected endpoints require a **Bearer JWT** in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Endpoints marked **`PUBLIC`** do not require authentication.

**Token lifetime:**
- Access token: **15 minutes**
- Refresh token: **7 days**

Always store the refresh token securely (e.g., Expo SecureStore). Silently refresh the access token before it expires.

---

## 2. Error Format

All errors return a consistent envelope:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

For validation errors, `message` may be an array of field-level strings:

```json
{
  "statusCode": 400,
  "message": ["phone must be a valid phone number", "code must be 6 characters"],
  "error": "Bad Request"
}
```

**Common status codes:**

| Code | Meaning |
|---|---|
| 400 | Validation error / bad input |
| 401 | Missing or expired token |
| 403 | Insufficient permissions for the action |
| 404 | Resource not found |
| 409 | Conflict (duplicate, already exists) |
| 429 | Rate limit exceeded |

---

## 3. Enums Reference

### Role
```
CUSTOMER | WORKER | ADMIN
```

### UserStatus
```
ACTIVE | SUSPENDED | DELETED
```

### WorkerStatus
```
PENDING | VERIFIED | REJECTED | SUSPENDED
```

### BookingStatus
```
PENDING     — awaiting worker response (30-min window)
ACCEPTED    — worker accepted; customer sees worker phone
REJECTED    — worker rejected; customer may rebook
IN_PROGRESS — worker marked arrival
COMPLETED   — job done; review prompt sent
CANCELLED   — cancelled by customer (pre-accept) or worker (post-accept = strike)
EXPIRED     — worker did not respond within 30 minutes
NO_SHOW     — admin-confirmed no-show; strike issued
```

### BookingType
```
IMMEDIATE  — same-day, ASAP
SCHEDULED  — up to 7 calendar days in advance
```

### TimeWindow
```
MORNING    — 06:00–12:00
AFTERNOON  — 12:00–18:00
EVENING    — 18:00–21:00
```

### StrikeReason
```
POST_ACCEPT_CANCELLATION | NO_SHOW | CUSTOMER_COMPLAINT
```

### CredentialType
```
LICENSE | CERTIFICATION | TRAINING
```

### Platform
```
IOS | ANDROID
```

---

## 4. Auth Endpoints

### POST `/auth/request-otp` — `PUBLIC`
Send a one-time password to a Philippine phone number.

**Rate limit:** 3 requests per 15 minutes per IP.

**Request body:**
```json
{
  "phone": "+639171234567"
}
```

**Response `200`:**
```json
{
  "message": "OTP sent."
}
```

---

### POST `/auth/verify-otp` — `PUBLIC`
Verify the OTP and receive JWT tokens. Creates the user account on first login.

**Rate limit:** 5 requests per 15 minutes per IP.

**Request body:**
```json
{
  "phone": "+639171234567",
  "code": "123456",
  "role": "CUSTOMER"
}
```

> `role` must be `CUSTOMER` or `WORKER`. Admin accounts are created out-of-band.
> On re-login, the `role` field must match the account's existing role.

**Response `200`:**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<token>",
  "user": {
    "id": "uuid",
    "phone": "+639171234567",
    "role": "CUSTOMER",
    "status": "ACTIVE"
  }
}
```

---

### POST `/auth/refresh` — `PUBLIC`
Exchange a refresh token for a new access token.

**Rate limit:** 10 requests per hour per IP.

**Request body:**
```json
{
  "refreshToken": "<token>"
}
```

**Response `200`:**
```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-token>"
}
```

---

### GET `/auth/sessions` — `PROTECTED`
List all active sessions for the current user.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "createdAt": "2026-07-12T08:00:00.000Z",
    "expiresAt": "2026-07-19T08:00:00.000Z"
  }
]
```

---

### DELETE `/auth/sessions/:tokenId` — `PROTECTED`
Revoke a specific session (logout from one device).

**Response `200`:**
```json
{ "message": "Session revoked." }
```

---

### DELETE `/auth/sessions` — `PROTECTED`
Revoke all sessions (logout from all devices).

**Response `200`:**
```json
{ "message": "All sessions revoked." }
```

---

## 5. User Endpoints

### GET `/users/me` — `PROTECTED`
Get the authenticated user's own record.

**Response `200`:**
```json
{
  "id": "uuid",
  "phone": "+639171234567",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

---

## 6. Customer Endpoints

All customer endpoints require the `CUSTOMER` role.

### GET `/customers/profile` — `PROTECTED`
Get the authenticated customer's profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "firstName": "Maria",
  "lastName": "Santos",
  "avatarUrl": "https://...",
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

---

### POST `/customers/profile` — `PROTECTED`
Create a customer profile (required after first login as CUSTOMER).

**Request body:**
```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "avatarUrl": "https://..."
}
```

> `avatarUrl` is optional. Must be `https://` URL if provided.

**Response `201`:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "firstName": "Maria",
  "lastName": "Santos",
  "avatarUrl": null,
  "createdAt": "2026-07-12T00:00:00.000Z"
}
```

---

### PATCH `/customers/profile` — `PROTECTED`
Update customer profile. All fields optional.

**Request body:** (same fields as `POST`, all optional)

---

## 7. Worker Endpoints

### GET `/workers/search` — `PUBLIC`
Search available workers. All query params are optional.

**Query params:**
```
categoryId    UUID      Filter by service category
barangayId    UUID      Filter by service area barangay
availableOnly boolean   true = only show online workers
page          integer   Default 1
limit         integer   Default 20, max 50
```

**Example:** `GET /workers/search?categoryId=<uuid>&availableOnly=true&page=1&limit=20`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "Rodel",
      "lastName": "Cruz",
      "bio": "15 years experience",
      "avatarUrl": null,
      "baseRate": "500.00",
      "isOnline": true,
      "averageRating": "4.50",
      "totalReviews": 12,
      "homeBarangay": { "id": "uuid", "name": "Camilmil" },
      "categories": [
        { "categoryId": "uuid", "name": "Electrical", "rateOverride": null }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5 }
}
```

> Worker phone numbers are **never** returned from search. Only revealed on booking acceptance.

---

### GET `/workers/:id` — `PUBLIC`
Get a worker's full public profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "firstName": "Rodel",
  "lastName": "Cruz",
  "bio": "...",
  "avatarUrl": null,
  "baseRate": "500.00",
  "isOnline": true,
  "status": "VERIFIED",
  "averageRating": "4.50",
  "totalReviews": 12,
  "totalJobsCompleted": 8,
  "homeBarangay": { "id": "uuid", "name": "Camilmil" },
  "categories": [
    { "categoryId": "uuid", "name": "Electrical", "rateOverride": "600.00" }
  ],
  "serviceAreas": [
    { "barangayId": "uuid", "name": "Camilmil" },
    { "barangayId": "uuid", "name": "Ibaba" }
  ]
}
```

---

### GET `/workers/profile` — `PROTECTED (WORKER)`
Get the authenticated worker's own profile (includes verification status).

---

### POST `/workers/profile` — `PROTECTED (WORKER)`
Create worker profile. Required after first login as WORKER.

**Request body:**
```json
{
  "firstName": "Rodel",
  "lastName": "Cruz",
  "bio": "15 years experience in electrical work.",
  "baseRate": 500,
  "homeBarangayId": "uuid",
  "categories": [
    { "categoryId": "uuid", "rateOverride": 600 },
    { "categoryId": "uuid" }
  ],
  "serviceAreaBarangayIds": ["uuid", "uuid"]
}
```

> `categories`: 1–3 items. `rateOverride` is optional per category.
> `serviceAreaBarangayIds`: 1–5 barangay UUIDs.
> `bio` and `avatarUrl` are optional.

---

### PATCH `/workers/profile` — `PROTECTED (WORKER)`
Update worker profile. All fields optional (same structure as POST).

---

### PATCH `/workers/availability` — `PROTECTED (WORKER)`
Toggle online/offline status. Worker must be VERIFIED to go online.

**Request body:**
```json
{ "isOnline": true }
```

**Response `200`:**
```json
{ "isOnline": true }
```

---

### POST `/workers/verification` — `PROTECTED (WORKER)`
Submit government ID photo and selfie for admin review. Uses `multipart/form-data`.

**Form fields:**
```
idPhoto   File   Government-issued ID photo (JPEG/PNG, max 5MB)
selfie    File   Selfie photo (JPEG/PNG, max 5MB)
```

> Worker status transitions to `PENDING` after submission. Admin reviews within 24 hours.

---

### POST `/workers/credentials` — `PROTECTED (WORKER)`
Upload a professional credential (license, certification, training). Uses `multipart/form-data`.

**Form fields:**
```
file   File     Credential document (JPEG/PNG/PDF, max 5MB)
type   string   One of: LICENSE | CERTIFICATION | TRAINING
```

---

## 8. Booking Endpoints

### POST `/bookings` — `PROTECTED (CUSTOMER)`
Create a new booking request.

**Request body:**
```json
{
  "workerId": "uuid",
  "categoryId": "uuid",
  "barangayId": "uuid",
  "bookingType": "IMMEDIATE",
  "scheduledDate": "2026-07-12T09:00:00.000Z",
  "timeWindow": "MORNING",
  "locationLat": 13.4125,
  "locationLng": 121.1796,
  "locationAddress": "123 Rizal St, Calapan",
  "notes": "Please bring your own tools.",
  "agreedRate": 600
}
```

> `bookingType`: `IMMEDIATE` for same-day; `SCHEDULED` for up to 7 days ahead.
> `locationAddress`: optional, max 300 chars.
> `notes`: optional, max 500 chars.
> `agreedRate`: optional negotiated rate; leave out to use worker's base rate.
> Worker has **30 minutes** to accept before the booking auto-expires.

**Response `201`:**
```json
{
  "id": "uuid",
  "status": "PENDING",
  "expiresAt": "2026-07-12T09:30:00.000Z",
  ...
}
```

---

### GET `/bookings` — `PROTECTED`
List bookings for the authenticated user (customer sees their own; worker sees theirs).

**Query params:**
```
status   "active" | "history"   Filter by group
page     integer
limit    integer
```

**Response `200`:**
```json
{
  "data": [ { ...booking } ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

---

### GET `/bookings/:id` — `PROTECTED`
Get a single booking's full details. Only visible to the customer or worker involved.

**Response `200` (after acceptance — includes worker phone):**
```json
{
  "id": "uuid",
  "status": "ACCEPTED",
  "bookingType": "IMMEDIATE",
  "scheduledDate": "2026-07-12T09:00:00.000Z",
  "timeWindow": "MORNING",
  "locationLat": 13.4125,
  "locationLng": 121.1796,
  "locationAddress": "123 Rizal St",
  "notes": "...",
  "agreedRate": "600.00",
  "expiresAt": "...",
  "acceptedAt": "...",
  "worker": {
    "id": "uuid",
    "firstName": "Rodel",
    "lastName": "Cruz",
    "phone": "+639171234567"
  },
  "customer": { "id": "uuid", "firstName": "Maria", "lastName": "Santos" },
  "category": { "id": "uuid", "name": "Electrical" }
}
```

> `worker.phone` is **only** present when `status === "ACCEPTED"` or later active states.

---

### PATCH `/bookings/:id/update` — `PROTECTED (CUSTOMER)`
Update a `PENDING` booking (before the worker responds).

**Request body:** (all fields optional, same shape as create)
```json
{
  "notes": "Updated notes",
  "timeWindow": "AFTERNOON"
}
```

---

### PATCH `/bookings/:id/accept` — `PROTECTED (WORKER)`
Accept a `PENDING` booking request.

**No request body.**

**Response `200`:** Returns updated booking with `status: "ACCEPTED"`.

---

### PATCH `/bookings/:id/reject` — `PROTECTED (WORKER)`
Reject a `PENDING` booking request.

**No request body.**

**Response `200`:** Returns updated booking with `status: "REJECTED"`.

---

### PATCH `/bookings/:id/start` — `PROTECTED (WORKER)`
Mark an `ACCEPTED` booking as `IN_PROGRESS` (worker arrived on-site).

**No request body.**

---

### PATCH `/bookings/:id/complete` — `PROTECTED (WORKER)`
Mark an `IN_PROGRESS` booking as `COMPLETED`. Triggers a review prompt push to the customer.

**No request body.**

---

### PATCH `/bookings/:id/cancel` — `PROTECTED`
Cancel a booking. Rules enforced server-side:
- Customer can cancel a `PENDING` booking freely.
- Worker cancellation after `ACCEPTED` issues an automatic strike.

**Request body:**
```json
{
  "cancellationReason": "Customer requested change of date."
}
```

> `cancellationReason` is optional, max 300 chars.

---

### PATCH `/bookings/:id/report-no-show` — `PROTECTED (CUSTOMER)`
Report a worker no-show. Can only be filed within 2 hours of the booking time window.

**Request body:**
```json
{
  "description": "Worker did not arrive and did not call."
}
```

> `description` is optional, max 500 chars. Admin will review and confirm or dismiss.

---

## 9. Reviews Endpoints

### POST `/reviews` — `PROTECTED (CUSTOMER)`
Submit a rating and review for a completed booking. One per booking, cannot be edited.

**Request body:**
```json
{
  "bookingId": "uuid",
  "rating": 5,
  "comment": "Excellent work, very professional."
}
```

> `rating`: integer 1–5.
> `comment`: optional, max 500 chars.

**Response `201`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "rating": 5,
  "comment": "Excellent work, very professional.",
  "createdAt": "..."
}
```

---

### GET `/reviews/my` — `PROTECTED (CUSTOMER)`
List reviews the authenticated customer has submitted.

**Query params:** `page`, `limit`

---

### GET `/reviews/worker/:id` — `PUBLIC`
Get paginated reviews for a specific worker. Used on the worker profile screen.

**Query params:** `page`, `limit`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Great work!",
      "createdAt": "...",
      "customer": { "firstName": "Maria", "lastName": "S." }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12 }
}
```

> Display the worker's `averageRating` from the worker profile, not computed client-side.
> Show the average only if `totalReviews >= 3` (UI rule per BRD REV-04).

---

## 10. Categories & Barangays

### GET `/categories` — `PUBLIC`
List active service categories for the category grid on the home screen.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Electrical",
    "slug": "electrical",
    "iconUrl": "https://...",
    "sortOrder": 1
  }
]
```

---

### GET `/barangays` — `PUBLIC`
List all barangays in the municipality. Used to populate picker dropdowns.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Camilmil",
    "psgcCode": "045818001",
    "centroidLat": "13.4125",
    "centroidLng": "121.1796"
  }
]
```

---

## 11. Notifications (Push Tokens)

Register the device's Expo push token immediately after login so the server can deliver booking events.

### POST `/notifications/push-token` — `PROTECTED`

**Request body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ANDROID"
}
```

> `platform`: `IOS` or `ANDROID`.

**Response `201`:**
```json
{ "message": "Push token registered." }
```

---

### DELETE `/notifications/push-token` — `PROTECTED`
Remove a push token on logout.

**Request body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

---

## 12. Booking Lifecycle — State Machine

```
                        ┌─────────────┐
                        │   PENDING   │ ← created by customer
                        └──────┬──────┘
              ┌────────────────┼────────────────┐
              │                │                │
          (accept)        (reject)          (30 min)
              │                │             passes
              ▼                ▼                ▼
        ┌──────────┐     ┌──────────┐     ┌─────────┐
        │ ACCEPTED │     │ REJECTED │     │ EXPIRED │
        └────┬─────┘     └──────────┘     └─────────┘
             │
      ┌──────┴──────────────────┐
      │                         │
   (start)                  (cancel by
      │                      worker*)
      ▼                         ▼
┌─────────────┐           ┌───────────┐
│ IN_PROGRESS │           │ CANCELLED │ ← *strike issued
└──────┬──────┘           └───────────┘
       │
    (complete)
       │
       ▼
┌───────────┐
│ COMPLETED │ → review prompt sent to customer
└───────────┘
       │
   (customer reports
    no-show within 2h)
       │
       ▼
┌─────────────┐
│   NO_SHOW   │ ← admin confirms → strike issued
└─────────────┘
```

**Rules summary:**
- Customer can cancel `PENDING` freely (no penalty).
- Worker cancellation of `ACCEPTED` → automatic `CANCELLED` + strike.
- `PENDING` auto-expires after 30 minutes (server cron job).
- `NO_SHOW` is set by admin after reviewing a customer report.

---

## 13. Typical App Flows

### Customer: First Login & Profile Setup

```
1. POST /auth/request-otp         { phone }
2. POST /auth/verify-otp          { phone, code, role: "CUSTOMER" }
   → store accessToken + refreshToken
3. POST /notifications/push-token { token, platform }
4. POST /customers/profile        { firstName, lastName }
5. GET  /users/me                 → confirm account
```

---

### Customer: Book a Worker

```
1. GET /categories                → populate home grid
2. GET /barangays                 → populate barangay picker
3. GET /workers/search?categoryId=<uuid>&barangayId=<uuid>&availableOnly=true
4. GET /workers/<id>              → view full profile + reviews
5. GET /reviews/worker/<id>       → display reviews
6. POST /bookings                 { workerId, categoryId, barangayId, ... }
   → polling or push notification for status changes
7. GET  /bookings/<id>            → check status; show worker phone when ACCEPTED
8. POST /reviews                  { bookingId, rating, comment }  ← after COMPLETED
```

---

### Worker: First Login & Onboarding

```
1. POST /auth/request-otp         { phone }
2. POST /auth/verify-otp          { phone, code, role: "WORKER" }
   → store tokens
3. POST /notifications/push-token { token, platform }
4. POST /workers/profile          { firstName, lastName, baseRate, homeBarangayId, categories, serviceAreaBarangayIds }
5. POST /workers/verification     multipart: { idPhoto: File, selfie: File }
   → worker status = PENDING; wait for admin approval
6. PATCH /workers/availability    { isOnline: true }  ← only allowed when VERIFIED
```

---

### Worker: Handle an Incoming Booking

```
Push notification received → open booking request modal

1. GET  /bookings/<id>            → show customer details, location, time window
2. PATCH /bookings/<id>/accept    (or /reject)
3. PATCH /bookings/<id>/start     ← on arrival
4. PATCH /bookings/<id>/complete  ← after job done
```

---

### Token Refresh Flow (silent, background)

```
On 401 response:
1. POST /auth/refresh             { refreshToken }
   → new accessToken + refreshToken
2. Retry the original request with new accessToken
3. If refresh also fails → force logout → navigate to login screen
```

---

## Notes for the Mobile Team

- **Phone format:** Always use E.164 format: `+63` followed by 10 digits (e.g., `+639171234567`).
- **UUIDs:** All entity IDs are UUIDs (v4). Store and send them as strings.
- **Decimal fields** (rates, coordinates) are returned as **strings** from the API — parse before arithmetic.
- **Pagination** — all list endpoints return `{ data: [...], meta: { page, limit, total } }`.
- **Worker phone:** Never displayed until `booking.status === "ACCEPTED"` (or later).
- **Rating display:** Only show average rating if `worker.totalReviews >= 3` (UI-layer rule).
- **Push notifications:** Register the Expo push token immediately after every login (token may rotate). Remove on logout.
- **Multipart uploads:** Verification and credential uploads use `multipart/form-data`, not JSON.
- **Rate limits:** OTP request is throttled to 3/15 min. Show a countdown UI to prevent user frustration.

---

*© 2026 UGNAY. Internal use only. For questions, contact the backend team.*
