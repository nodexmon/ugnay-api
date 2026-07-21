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
14. [Admin Endpoints](#14-admin-endpoints)

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
PENDING    — submitted application, awaiting admin review
VERIFIED   — admin approved; can receive bookings
REJECTED   — admin rejected; may reapply once
SUSPENDED  — suspended due to strikes or complaints
```

### BookingStatus
```
PENDING     — awaiting worker response (30-min window)
ACCEPTED    — worker accepted; contact details revealed
REJECTED    — worker rejected; customer may rebook
IN_PROGRESS — worker marked arrival on-site
COMPLETED   — job done; review prompt sent to customer
CANCELLED   — cancelled by customer (pre-accept) or worker (post-accept = strike)
EXPIRED     — worker did not respond within 30 minutes
NO_SHOW          — admin-confirmed worker no-show; strike issued
CUSTOMER_NO_SHOW — admin-confirmed customer no-show; no strike
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

### VerificationStatus
```
PENDING | APPROVED | REJECTED
```

### CredentialType
```
LICENSE | CERTIFICATION | TRAINING
```

### Platform
```
IOS | ANDROID
```

### CancellationActor
```
CUSTOMER | WORKER | SYSTEM
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
  "message": "OTP has been sent to +639171234567"
}
```

> The message includes the phone number to confirm delivery target.

---

### POST `/auth/verify-otp` — `PUBLIC`
Verify the OTP. Returns different shapes depending on whether the phone is already registered.

**Rate limit:** 5 requests per 15 minutes per IP.

**Request body:**
```json
{
  "phone": "+639171234567",
  "code": "123456"
}
```

**Response `200` — existing user (returning login):**
```json
{
  "type": "login",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200` — new phone (first-time registration):**
```json
{
  "type": "registration",
  "registrationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> Check `type` to know what to render next:
> - `"login"` → store tokens and proceed to home. Call `GET /users/me` to check if a profile still needs to be created.
> - `"registration"` → show the role picker, then call `POST /auth/register`.
> The `registrationToken` expires in **15 minutes**. Do not store it beyond the registration screen.

---

### POST `/auth/register` — `PUBLIC`
Complete registration for a new user. Requires the `registrationToken` returned from `verify-otp`.

**Rate limit:** 5 requests per 15 minutes per IP.

**Request body:**
```json
{
  "registrationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CUSTOMER"
}
```

> `role` must be `CUSTOMER` or `WORKER`. Admin accounts are created out-of-band.
> Returns `401` if the registration token is expired, tampered, or already used.
> Returns `409` if the phone was registered by another request in the meantime (race condition guard).

**Response `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> No `user` object in this response. Call `GET /users/me` after registration to check whether a profile needs to be created.

---

### POST `/auth/refresh` — `PUBLIC`
Exchange a refresh token for a new token pair. The old refresh token is immediately revoked on use.

**Rate limit:** 10 requests per hour per IP.

**Request body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> Both tokens rotate on every refresh. Always store the new `refreshToken` — the old one is dead.

---

### GET `/auth/sessions` — `PROTECTED`
List all active (non-revoked, non-expired) sessions for the current user.

**Response `200`:**
```json
[
  {
    "id": "82000000-0000-4000-8000-000000000001",
    "createdAt": "2026-07-01T08:00:00.000Z",
    "updatedAt": "2026-07-05T10:30:00.000Z"
  }
]
```

> `id` is the session token ID — use it to target a specific session for revocation.

---

### DELETE `/auth/sessions/:tokenId` — `PROTECTED`
Revoke a specific session (logout from one device).

**Response `200`:**
```json
{
  "message": "Session revoked."
}
```

---

### DELETE `/auth/sessions` — `PROTECTED`
Revoke all sessions (logout from all devices).

**Response `200`:**
```json
{
  "message": "All sessions revoked."
}
```

---

## 5. User Endpoints

### GET `/users/me` — `PROTECTED`
Get the authenticated user's account record, including their profile if it exists. Use this immediately after login to determine app routing (profile setup vs. home screen).

**Response `200`:**
```json
{
  "id": "30000000-0000-4000-8000-000000000002",
  "phone": "+639170000002",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "workerProfile": null,
  "customerProfile": {
    "id": "40000000-0000-4000-8000-000000000001",
    "userId": "30000000-0000-4000-8000-000000000002",
    "firstName": "Mika",
    "lastName": "Santos",
    "avatarUrl": "https://example.com/avatars/customer-mika.jpg",
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
}
```

For a `WORKER` account, `workerProfile` is populated and `customerProfile` is `null`:
```json
{
  "id": "30000000-0000-4000-8000-000000000005",
  "phone": "+639170000005",
  "role": "WORKER",
  "status": "ACTIVE",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "customerProfile": null,
  "workerProfile": {
    "id": "50000000-0000-4000-8000-000000000001",
    "userId": "30000000-0000-4000-8000-000000000005",
    "firstName": "Jun",
    "lastName": "Garcia",
    "bio": "Licensed electrician for residential repairs.",
    "avatarUrl": "https://example.com/avatars/worker-jun.jpg",
    "baseRate": "650.00",
    "status": "VERIFIED",
    "isOnline": true,
    "homeBarangayId": "20000000-0000-4000-8000-000000000001",
    "strikeCount": 0,
    "totalJobsCompleted": 24,
    "averageRating": "4.82",
    "totalReviews": 17,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z",
    "homeBarangay": {
      "id": "20000000-0000-4000-8000-000000000001",
      "psgcCode": null,
      "name": "Canubing I",
      "centroidLat": null,
      "centroidLng": null,
      "isActive": true
    },
    "categories": [
      {
        "id": "uuid",
        "workerId": "50000000-0000-4000-8000-000000000001",
        "categoryId": "10000000-0000-4000-8000-000000000001",
        "rateOverride": null,
        "createdAt": "2026-07-01T00:00:00.000Z",
        "category": {
          "id": "10000000-0000-4000-8000-000000000001",
          "name": "Electrician",
          "slug": "electrician",
          "iconUrl": "https://example.com/icons/electrician.svg",
          "isActive": true,
          "sortOrder": 1,
          "createdAt": "2026-07-01T00:00:00.000Z",
          "updatedAt": "2026-07-01T00:00:00.000Z"
        }
      }
    ],
    "serviceAreas": [
      {
        "id": "uuid",
        "workerId": "50000000-0000-4000-8000-000000000001",
        "barangayId": "20000000-0000-4000-8000-000000000001",
        "createdAt": "2026-07-01T00:00:00.000Z",
        "barangay": {
          "id": "20000000-0000-4000-8000-000000000001",
          "psgcCode": null,
          "name": "Canubing I",
          "centroidLat": null,
          "centroidLng": null,
          "isActive": true
        }
      }
    ]
  }
}
```

> **Routing rule:** If `role === "CUSTOMER"` and `customerProfile === null` → navigate to customer profile setup. If `role === "WORKER"` and `workerProfile === null` → navigate to worker profile setup. If profile exists, check `workerProfile.status` — only `VERIFIED` workers can go online.

---

## 6. Customer Endpoints

All customer endpoints require `CUSTOMER` role.

### GET `/customers/profile` — `PROTECTED (CUSTOMER)`
Get the authenticated customer's profile.

**Response `200`:**
```json
{
  "id": "40000000-0000-4000-8000-000000000001",
  "userId": "30000000-0000-4000-8000-000000000002",
  "firstName": "Mika",
  "lastName": "Santos",
  "avatarUrl": "https://example.com/avatars/customer-mika.jpg",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z"
}
```

---

### POST `/customers/profile` — `PROTECTED (CUSTOMER)`
Create the customer profile. Required after first login as CUSTOMER before any booking.

**Request body:**
```json
{
  "firstName": "Mika",
  "lastName": "Santos",
  "avatarUrl": "https://example.com/avatars/customer-mika.jpg"
}
```

> `avatarUrl` is optional. Omit or pass `null` to leave it blank.
> `firstName`/`lastName`: required, max 100 chars each.

**Response `201`:** Same shape as `GET /customers/profile`.

---

### PATCH `/customers/profile` — `PROTECTED (CUSTOMER)`
Update the customer profile. All fields are optional.

**Request body:**
```json
{
  "firstName": "Michaela",
  "lastName": "Santos",
  "avatarUrl": null
}
```

**Response `200`:** Same shape as `GET /customers/profile`.

---

## 7. Worker Endpoints

### GET `/workers/search` — `PUBLIC`
Search VERIFIED, active workers. Returns a plain array ordered by `averageRating DESC`, `totalReviews DESC`, `createdAt DESC`.

> Workers with a `PENDING`, `ACCEPTED`, or `IN_PROGRESS` booking are excluded from results — they are unavailable for new bookings.

**Query params:**
```
categoryId    UUID      Filter by service category ID
barangayId    UUID      Filter by service area — only workers who serve this barangay
availableOnly boolean   true = only online workers (isOnline: true)
skip          integer   Records to skip (default 0)
take          integer   Records to return (default 10, max 50)
```

**Example:** `GET /workers/search?categoryId=<uuid>&barangayId=<uuid>&availableOnly=true&skip=0&take=10`

**Response `200`:** Plain array (no pagination wrapper):
```json
[
  {
    "id": "50000000-0000-4000-8000-000000000001",
    "userId": "30000000-0000-4000-8000-000000000005",
    "firstName": "Jun",
    "lastName": "Garcia",
    "bio": "Licensed electrician for residential repairs, rewiring, and fixture installation.",
    "avatarUrl": "https://example.com/avatars/worker-jun.jpg",
    "baseRate": "650.00",
    "status": "VERIFIED",
    "isOnline": true,
    "homeBarangayId": "20000000-0000-4000-8000-000000000001",
    "strikeCount": 0,
    "totalJobsCompleted": 24,
    "averageRating": "4.82",
    "totalReviews": 17,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z",
    "homeBarangay": {
      "id": "20000000-0000-4000-8000-000000000001",
      "psgcCode": null,
      "name": "Canubing I",
      "centroidLat": null,
      "centroidLng": null,
      "isActive": true
    },
    "categories": [
      {
        "id": "uuid",
        "workerId": "50000000-0000-4000-8000-000000000001",
        "categoryId": "10000000-0000-4000-8000-000000000001",
        "rateOverride": null,
        "createdAt": "2026-07-01T00:00:00.000Z",
        "category": {
          "id": "10000000-0000-4000-8000-000000000001",
          "name": "Electrician",
          "slug": "electrician",
          "iconUrl": "https://example.com/icons/electrician.svg",
          "isActive": true,
          "sortOrder": 1,
          "createdAt": "2026-07-01T00:00:00.000Z",
          "updatedAt": "2026-07-01T00:00:00.000Z"
        }
      }
    ],
    "serviceAreas": [
      {
        "id": "uuid",
        "workerId": "50000000-0000-4000-8000-000000000001",
        "barangayId": "20000000-0000-4000-8000-000000000001",
        "createdAt": "2026-07-01T00:00:00.000Z",
        "barangay": {
          "id": "20000000-0000-4000-8000-000000000001",
          "psgcCode": null,
          "name": "Canubing I",
          "centroidLat": null,
          "centroidLng": null,
          "isActive": true
        }
      }
    ],
    "credentials": [
      { "type": "LICENSE" }
    ]
  }
]
```

> `credentials` — only `APPROVED` credentials are returned from search, and only the `type` field. No file URLs.
> `baseRate`, `rateOverride`, `averageRating` are **Decimal strings** — parse before arithmetic.
> **`averageRating` is `null`** when `totalReviews < 3`. This is enforced server-side — do not compute or display client-side.
> Worker phone numbers are **never** returned from search. Only revealed on booking acceptance.
> There is **no total count** in this response. Use `skip`/`take` to paginate client-side.

---

### GET `/workers/:id` — `PUBLIC`
Get a single worker's full public profile.

**Response `200`:**
```json
{
  "id": "50000000-0000-4000-8000-000000000001",
  "userId": "30000000-0000-4000-8000-000000000005",
  "firstName": "Jun",
  "lastName": "Garcia",
  "bio": "Licensed electrician for residential repairs, rewiring, and fixture installation.",
  "avatarUrl": "https://example.com/avatars/worker-jun.jpg",
  "baseRate": "650.00",
  "status": "VERIFIED",
  "isOnline": true,
  "homeBarangayId": "20000000-0000-4000-8000-000000000001",
  "strikeCount": 0,
  "totalJobsCompleted": 24,
  "averageRating": "4.82",
  "totalReviews": 17,
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "homeBarangay": {
    "id": "20000000-0000-4000-8000-000000000001",
    "psgcCode": null,
    "name": "Canubing I",
    "centroidLat": null,
    "centroidLng": null,
    "isActive": true
  },
  "categories": [
    {
      "id": "uuid",
      "workerId": "50000000-0000-4000-8000-000000000001",
      "categoryId": "10000000-0000-4000-8000-000000000001",
      "rateOverride": null,
      "createdAt": "2026-07-01T00:00:00.000Z",
      "category": {
        "id": "10000000-0000-4000-8000-000000000001",
        "name": "Electrician",
        "slug": "electrician",
        "iconUrl": "https://example.com/icons/electrician.svg",
        "isActive": true,
        "sortOrder": 1,
        "createdAt": "2026-07-01T00:00:00.000Z",
        "updatedAt": "2026-07-01T00:00:00.000Z"
      }
    }
  ],
  "serviceAreas": [
    {
      "id": "uuid",
      "workerId": "50000000-0000-4000-8000-000000000001",
      "barangayId": "20000000-0000-4000-8000-000000000001",
      "createdAt": "2026-07-01T00:00:00.000Z",
      "barangay": {
        "id": "20000000-0000-4000-8000-000000000001",
        "psgcCode": null,
        "name": "Canubing I",
        "centroidLat": null,
        "centroidLng": null,
        "isActive": true
      }
    }
  ],
  "credentials": [
    { "type": "LICENSE" }
  ]
}
```

> **`averageRating` is `null`** when `totalReviews < 3`. This is enforced server-side — do not compute client-side.
> Only `VERIFIED` workers with `ACTIVE` user accounts are accessible from this endpoint. Others return `404`.
> `credentials` — only `APPROVED` credentials with just the `type` field (same as search).

---

### GET `/workers/profile` — `PROTECTED (WORKER)`
Get the authenticated worker's **own** full profile, including all verification docs and credentials (with full details and file URLs).

**Response `200`:** Same base shape as the public profile but with additional fields:
```json
{
  "id": "50000000-0000-4000-8000-000000000001",
  "userId": "30000000-0000-4000-8000-000000000005",
  "firstName": "Jun",
  "lastName": "Garcia",
  "bio": "Licensed electrician for residential repairs.",
  "avatarUrl": "https://example.com/avatars/worker-jun.jpg",
  "baseRate": "650.00",
  "status": "VERIFIED",
  "isOnline": true,
  "homeBarangayId": "20000000-0000-4000-8000-000000000001",
  "strikeCount": 0,
  "totalJobsCompleted": 24,
  "averageRating": "4.82",
  "totalReviews": 17,
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "homeBarangay": { "...same as public..." },
  "categories": [ "...same as public..." ],
  "serviceAreas": [ "...same as public..." ],
  "verificationDocs": [
    {
      "id": "70000000-0000-4000-8000-000000000001",
      "workerId": "50000000-0000-4000-8000-000000000001",
      "idPhotoUrl": "/seed/verification/50000000.../id-photo.jpg",
      "selfieUrl": "/seed/verification/50000000.../selfie.jpg",
      "status": "APPROVED",
      "rejectionReason": null,
      "reviewedBy": "30000000-0000-4000-8000-000000000001",
      "reviewedAt": "2026-06-22T10:00:00.000Z",
      "createdAt": "2026-06-22T09:00:00.000Z",
      "updatedAt": "2026-06-22T10:00:00.000Z"
    }
  ],
  "credentials": [
    {
      "id": "uuid",
      "workerId": "50000000-0000-4000-8000-000000000001",
      "type": "LICENSE",
      "fileUrl": "/uploads/workers/50000000.../credentials/license-abc123.jpg",
      "status": "PENDING",
      "rejectionReason": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-07-01T00:00:00.000Z",
      "updatedAt": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

> Unlike the public endpoint, `averageRating` is **never nulled** on own-profile — always returns the raw value.
> `verificationDocs` and `credentials` are ordered by `createdAt DESC` — newest first.
> `credentials` returns **all** credentials (not just APPROVED), with full fields including file URLs.

---

### POST `/workers/profile` — `PROTECTED (WORKER)`
Create the worker profile. Required after first login as WORKER.

**Request body:**
```json
{
  "firstName": "Jun",
  "lastName": "Garcia",
  "bio": "Licensed electrician for residential repairs.",
  "baseRate": 650,
  "homeBarangayId": "20000000-0000-4000-8000-000000000001",
  "categories": [
    { "categoryId": "10000000-0000-4000-8000-000000000001", "rateOverride": 800 },
    { "categoryId": "10000000-0000-4000-8000-000000000007" }
  ],
  "serviceAreaBarangayIds": [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002"
  ]
}
```

> `categories`: 1–3 items. `rateOverride` is optional — omit to use `baseRate` for that category.
> `serviceAreaBarangayIds`: 1–5 barangay UUIDs. Must include `homeBarangayId` or the home barangay must be in the list — duplicates are de-duped server-side.
> `bio` and `avatarUrl` are optional.
> New worker profile always starts with `status: "PENDING"`.

**Response `201`:** Same shape as `GET /workers/profile` (full profile with all includes).

---

### PATCH `/workers/profile` — `PROTECTED (WORKER)`
Update the worker profile. All fields are optional.

**Request body:** Same fields as `POST /workers/profile`, all optional.

> When `categories` is provided, it **replaces** all existing categories.
> When `serviceAreaBarangayIds` is provided, it **replaces** all existing service areas.

**Response `200`:** Same shape as `GET /workers/profile`.

---

### PATCH `/workers/availability` — `PROTECTED (WORKER)`
Toggle online/offline status.

**Request body:**
```json
{ "isOnline": true }
```

> Going online (`isOnline: true`) requires `status === "VERIFIED"`. Returns `403` otherwise.

**Response `200`:** Full worker profile with all includes — same shape as `GET /workers/profile`.

---

### POST `/workers/verification` — `PROTECTED (WORKER)`
Submit government ID photo and selfie for admin review. Uses `multipart/form-data`.

**Form fields:**
```
idPhoto   File   Government-issued ID photo (JPEG/PNG, max 5 MB)
selfie    File   Selfie photo (JPEG/PNG, max 5 MB)
```

> Worker `status` transitions to `PENDING` after submission.
> Returns `409` if a PENDING submission already exists.
> Returns `403` if verification has already been rejected twice (reapplication limit).
> Returns `409` if worker is already `VERIFIED`.

**Response `201`:**
```json
{
  "id": "70000000-0000-4000-8000-000000000001",
  "workerId": "50000000-0000-4000-8000-000000000001",
  "idPhotoUrl": "/uploads/workers/50000000.../id-photo-abc123.jpg",
  "selfieUrl": "/uploads/workers/50000000.../selfie-def456.jpg",
  "status": "PENDING",
  "rejectionReason": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "createdAt": "2026-07-12T08:00:00.000Z",
  "updatedAt": "2026-07-12T08:00:00.000Z"
}
```

---

### GET `/workers/verification` — `PROTECTED (WORKER)`
Get the authenticated worker's most recent verification document submission.

**Response `200`:** The latest `VerificationDoc` object (same shape as the item inside `verificationDocs` on `GET /workers/profile`), or `null` if no submission exists yet.

```json
{
  "id": "70000000-0000-4000-8000-000000000001",
  "workerId": "50000000-0000-4000-8000-000000000001",
  "idPhotoUrl": "/uploads/workers/50000000.../id-photo-abc123.jpg",
  "selfieUrl": "/uploads/workers/50000000.../selfie-def456.jpg",
  "status": "APPROVED",
  "rejectionReason": null,
  "reviewedBy": "30000000-0000-4000-8000-000000000001",
  "reviewedAt": "2026-07-12T10:00:00.000Z",
  "createdAt": "2026-07-12T08:00:00.000Z",
  "updatedAt": "2026-07-12T10:00:00.000Z"
}
```

> Use `status` to determine what to show: `PENDING` = under review, `APPROVED` = verified, `REJECTED` = show rejection reason and allow resubmission.

---

### POST `/workers/credentials` — `PROTECTED (WORKER)`
Upload a professional credential. Uses `multipart/form-data`.

**Form fields:**
```
file   File     Credential document (JPEG/PNG/PDF, max 5 MB)
type   string   One of: LICENSE | CERTIFICATION | TRAINING
```

> Maximum 5 active (PENDING or APPROVED) credentials at a time.

**Response `201`:**
```json
{
  "id": "uuid",
  "workerId": "50000000-0000-4000-8000-000000000001",
  "type": "LICENSE",
  "fileUrl": "/uploads/workers/50000000.../credentials/license-abc123.pdf",
  "status": "PENDING",
  "rejectionReason": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "createdAt": "2026-07-12T08:00:00.000Z",
  "updatedAt": "2026-07-12T08:00:00.000Z"
}
```

---

### GET `/workers/strikes` — `PROTECTED (WORKER)`
Get the authenticated worker's strike history and total strike count.

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "workerId": "50000000-0000-4000-8000-000000000001",
      "bookingId": "60000000-0000-4000-8000-000000000001",
      "reason": "POST_ACCEPT_CANCELLATION",
      "notes": null,
      "issuedBy": "30000000-0000-4000-8000-000000000001",
      "createdAt": "2026-07-10T09:00:00.000Z"
    }
  ],
  "total": 1
}
```

> `total` mirrors `workerProfile.strikeCount`. At 3 strikes the account is suspended.
> `reason` is one of: `POST_ACCEPT_CANCELLATION | NO_SHOW | CUSTOMER_COMPLAINT`.

---

## 8. Booking Endpoints

### POST `/bookings` — `PROTECTED (CUSTOMER)`
Create a new booking request. The worker has 30 minutes to respond.

**Request body:**
```json
{
  "workerId": "50000000-0000-4000-8000-000000000001",
  "categoryId": "10000000-0000-4000-8000-000000000001",
  "barangayId": "20000000-0000-4000-8000-000000000001",
  "bookingType": "IMMEDIATE",
  "scheduledDate": "2026-07-12T09:00:00.000Z",
  "timeWindow": "MORNING",
  "locationLat": 14.6001,
  "locationLng": 120.9845,
  "locationAddress": "12 Mabini Street, Canubing I",
  "notes": "Outlet sparks when the rice cooker is plugged in."
}
```

> `bookingType`: `IMMEDIATE` (same-day) or `SCHEDULED` (up to 7 days ahead).
> `scheduledDate`: must be in the future (PST); max 7 days from now. Same-day dates are forced to `IMMEDIATE` regardless of `bookingType`.
> `locationAddress`: optional, max 300 chars.
> `notes`: optional, max 500 chars.
> **`agreedRate` is not sent by the client.** The server snapshots the rate automatically from the worker's category-specific `rateOverride`, falling back to their `baseRate`. This value is locked at booking creation and never changes.
> Returns `403` if the customer has no profile yet.
> Returns `403` if the worker is not online, not `VERIFIED`, or their user account is not `ACTIVE`.
> Returns `422` if the targeted worker already has a `PENDING`, `ACCEPTED`, or `IN_PROGRESS` booking.
> Returns `422` if the worker does not offer the requested `categoryId`.
> Returns `422` if the worker does not serve the requested `barangayId`.
> Returns `409` if two requests race to book the same worker simultaneously (DB-level guard).

**Response `201`:**
```json
{
  "id": "60000000-0000-4000-8000-000000000001",
  "customerId": "40000000-0000-4000-8000-000000000001",
  "workerId": "50000000-0000-4000-8000-000000000001",
  "categoryId": "10000000-0000-4000-8000-000000000001",
  "barangayId": "20000000-0000-4000-8000-000000000001",
  "status": "PENDING",
  "bookingType": "IMMEDIATE",
  "scheduledDate": "2026-07-12T09:00:00.000Z",
  "timeWindow": "MORNING",
  "locationLat": "14.6001000",
  "locationLng": "120.9845000",
  "locationAddress": "12 Mabini Street, Canubing I",
  "notes": "Outlet sparks when the rice cooker is plugged in.",
  "agreedRate": "700.00",
  "acceptedAt": null,
  "rejectedAt": null,
  "startedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "expiresAt": "2026-07-12T09:30:00.000Z",
  "cancellationActor": null,
  "cancellationReason": null,
  "createdAt": "2026-07-12T09:00:00.000Z",
  "updatedAt": "2026-07-12T09:00:00.000Z"
}
```

> `locationLat`, `locationLng`, `agreedRate` are **Decimal strings**.
> No nested joins — use `GET /bookings/:id` for the full enriched view.

---

### GET `/bookings` — `PROTECTED`
List bookings for the authenticated user. Customers see their own bookings; workers see bookings assigned to them. Returned as a **plain array** ordered by `createdAt DESC`.

**Query params:**
```
status   "active" | "history"   Filter by group (see below)
skip     integer                 Records to skip (default 0)
take     integer                 Records to return (default 10, max 50)
```

> `active` includes: `PENDING`, `ACCEPTED`, `IN_PROGRESS`
> `history` includes: `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `NO_SHOW`, `CUSTOMER_NO_SHOW`
> Omit `status` to return all bookings.

**Response `200` (customer view):** Plain array where each item includes a `worker` snippet:
```json
[
  {
    "id": "60000000-0000-4000-8000-000000000001",
    "customerId": "40000000-0000-4000-8000-000000000001",
    "workerId": "50000000-0000-4000-8000-000000000001",
    "categoryId": "10000000-0000-4000-8000-000000000001",
    "barangayId": "20000000-0000-4000-8000-000000000001",
    "status": "PENDING",
    "bookingType": "IMMEDIATE",
    "scheduledDate": "2026-07-12T09:00:00.000Z",
    "timeWindow": "MORNING",
    "locationLat": "14.6001000",
    "locationLng": "120.9845000",
    "locationAddress": "12 Mabini Street, Canubing I",
    "notes": "Outlet sparks when the rice cooker is plugged in.",
    "agreedRate": null,
    "acceptedAt": null,
    "rejectedAt": null,
    "startedAt": null,
    "completedAt": null,
    "cancelledAt": null,
    "expiresAt": "2026-07-12T09:30:00.000Z",
    "cancellationActor": null,
    "cancellationReason": null,
    "createdAt": "2026-07-12T09:00:00.000Z",
    "updatedAt": "2026-07-12T09:00:00.000Z",
    "worker": {
      "firstName": "Jun",
      "lastName": "Garcia",
      "avatarUrl": "https://example.com/avatars/worker-jun.jpg",
      "averageRating": "4.82"
    },
    "category": {
      "name": "Electrician",
      "iconUrl": "https://example.com/icons/electrician.svg"
    },
    "barangay": {
      "name": "Canubing I"
    }
  }
]
```

**Response `200` (worker view):** Same base fields, but `customer` is returned instead of `worker`:
```json
[
  {
    "...base booking fields...",
    "customer": {
      "firstName": "Mika",
      "lastName": "Santos",
      "avatarUrl": "https://example.com/avatars/customer-mika.jpg"
    },
    "category": { "name": "Electrician", "iconUrl": "..." },
    "barangay": { "name": "Canubing I" }
  }
]
```

> No pagination metadata is returned. Use `skip`/`take` to paginate.

---

### GET `/bookings/:id` — `PROTECTED`
Get a single booking's full details. Only accessible to the customer or worker involved.

**Response `200`:**
```json
{
  "id": "60000000-0000-4000-8000-000000000002",
  "customerId": "40000000-0000-4000-8000-000000000002",
  "workerId": "50000000-0000-4000-8000-000000000006",
  "categoryId": "10000000-0000-4000-8000-000000000007",
  "barangayId": "20000000-0000-4000-8000-000000000006",
  "status": "ACCEPTED",
  "bookingType": "SCHEDULED",
  "scheduledDate": "2026-07-13T14:00:00.000Z",
  "timeWindow": "AFTERNOON",
  "locationLat": "14.6147000",
  "locationLng": "120.9825000",
  "locationAddress": "88 Rizal Avenue, Masipit",
  "notes": "Front-load washing machine stops mid-cycle.",
  "agreedRate": "750.00",
  "acceptedAt": "2026-07-12T08:45:00.000Z",
  "rejectedAt": null,
  "startedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "expiresAt": "2026-07-12T09:00:00.000Z",
  "cancellationActor": null,
  "cancellationReason": null,
  "createdAt": "2026-07-12T08:30:00.000Z",
  "updatedAt": "2026-07-12T08:45:00.000Z",
  "worker": {
    "firstName": "Bea",
    "lastName": "Mendoza",
    "avatarUrl": "https://example.com/avatars/worker-bea.jpg",
    "averageRating": "4.74",
    "baseRate": "600.00",
    "user": {
      "phone": "+639170000010"
    }
  },
  "customer": {
    "firstName": "Rafael",
    "lastName": "Dela Cruz",
    "avatarUrl": "https://example.com/avatars/customer-rafael.jpg",
    "user": {
      "phone": "+639170000003"
    }
  },
  "category": {
    "name": "Appliance Repair",
    "iconUrl": "https://example.com/icons/appliance-repair.svg"
  },
  "barangay": {
    "name": "Masipit"
  },
  "review": null
}
```

> **Contact reveal:** `worker.user.phone` and `customer.user.phone` are only present when `status` is `ACCEPTED`, `IN_PROGRESS`, or `COMPLETED`. For all other statuses, `worker.user` and `customer.user` are `undefined` (absent from JSON).
> `review` — the full `Review` object is included once the booking is `COMPLETED` and a review has been submitted; `null` until then.
> `averageRating` and `baseRate` on the `worker` snippet are Decimal strings.

---

### PATCH `/bookings/:id` — `PROTECTED (CUSTOMER)`
Update a `PENDING` booking before the worker responds.

**Request body:** (all fields optional, same types as create)
```json
{
  "notes": "Updated notes — please bring a multimeter.",
  "timeWindow": "AFTERNOON",
  "locationAddress": "New address"
}
```

**Response `200`:** Empty body (`null`).

---

### PATCH `/bookings/:id/accept` — `PROTECTED (WORKER)`
Accept a `PENDING` booking. Worker must own the booking.

**No request body.**

**Response `200`:** Empty body. Poll `GET /bookings/:id` or listen for push notifications for the updated state.

---

### PATCH `/bookings/:id/reject` — `PROTECTED (WORKER)`
Reject a `PENDING` booking. Worker must own the booking. No penalty.

**No request body.**

**Response `200`:** Empty body.

---

### PATCH `/bookings/:id/start` — `PROTECTED (WORKER)`
Mark an `ACCEPTED` booking as `IN_PROGRESS` (worker arrived on-site).

**No request body.**

**Response `200`:** Empty body.

---

### PATCH `/bookings/:id/complete` — `PROTECTED (WORKER)`
Mark an `IN_PROGRESS` booking as `COMPLETED`. Triggers a review-prompt push notification to the customer.

**No request body.**

**Response `200`:** Empty body.

---

### PATCH `/bookings/:id/cancel` — `PROTECTED`
Cancel a booking. Server enforces the following rules:
- **Customer** can cancel a `PENDING` or `ACCEPTED` booking freely (no penalty).
- **Worker** can cancel an `ACCEPTED` or `IN_PROGRESS` booking — an automatic strike is issued and the count is incremented. If `strikeCount` reaches 3, the worker is suspended.

**Request body:**
```json
{
  "cancellationReason": "Customer requested change of date."
}
```

> `cancellationReason` is **required for workers**, optional for customers. Max 300 chars.
> Returns `403` if the booking is in a status that does not allow cancellation for the caller's role.
> Returns `400` if the caller is a worker and `cancellationReason` is missing.

**Response `200`:** Empty body.

---

### PATCH `/bookings/:id/report-no-show` — `PROTECTED (CUSTOMER)`
Report a worker no-show. Can only be filed when the booking is in `ACCEPTED` or `IN_PROGRESS` status. Admin will review and confirm or dismiss.

**Request body:**
```json
{
  "description": "Worker did not arrive and did not answer calls."
}
```

> `description` is optional, max 500 chars.

**Response `200`:**
```json
{
  "id": "91000000-0000-4000-8000-000000000001",
  "bookingId": "60000000-0000-4000-8000-000000000008",
  "reportedBy": "30000000-0000-4000-8000-000000000003",
  "description": "Worker did not arrive and did not answer calls.",
  "resolvedBy": null,
  "resolvedAt": null,
  "confirmed": null,
  "createdAt": "2026-07-12T09:00:00.000Z",
  "updatedAt": "2026-07-12T09:00:00.000Z"
}
```

> `confirmed: null` = pending admin review. `true` = strike issued. `false` = dismissed.

---

### PATCH `/bookings/:id/report-customer-no-show` — `PROTECTED (WORKER)`
Report that the customer did not show up at the agreed location. Can only be filed when the booking is `ACCEPTED` or `IN_PROGRESS`. Worker must own the booking. Admin will review and confirm or dismiss.

**Request body:**
```json
{
  "description": "Customer did not arrive and is not answering."
}
```

> `description` is optional, max 500 chars.

**Response `200`:**
```json
{
  "id": "91000000-0000-4000-8000-000000000002",
  "bookingId": "60000000-0000-4000-8000-000000000008",
  "reportedBy": "30000000-0000-4000-8000-000000000005",
  "description": "Customer did not arrive and is not answering.",
  "resolvedBy": null,
  "resolvedAt": null,
  "confirmed": null,
  "createdAt": "2026-07-12T09:00:00.000Z",
  "updatedAt": "2026-07-12T09:00:00.000Z"
}
```

> `confirmed: null` = pending admin review. `true` = booking set to `CUSTOMER_NO_SHOW`. `false` = dismissed.
> Only one pending report per booking is allowed.

---

## 9. Reviews Endpoints

### POST `/reviews` — `PROTECTED (CUSTOMER)`
Submit a review for a `COMPLETED` booking. One review per booking; cannot be edited.

**Request body:**
```json
{
  "bookingId": "60000000-0000-4000-8000-000000000004",
  "rating": 5,
  "comment": "Arrived on time and explained the wiring issue clearly."
}
```

> `rating`: integer 1–5.
> `comment`: optional, max 500 chars.
> Returns `403` if the customer did not own the booking.
> Returns `409` if a review for this booking already exists.

**Response `201`:**
```json
{
  "id": "90000000-0000-4000-8000-000000000001",
  "bookingId": "60000000-0000-4000-8000-000000000004",
  "workerId": "50000000-0000-4000-8000-000000000001",
  "customerId": "40000000-0000-4000-8000-000000000002",
  "rating": 5,
  "comment": "Arrived on time and explained the wiring issue clearly.",
  "createdAt": "2026-07-09T18:00:00.000Z"
}
```

> The worker's `averageRating` and `totalReviews` are updated atomically on the server.

---

### GET `/reviews/my` — `PROTECTED (CUSTOMER)`
List all reviews submitted by the authenticated customer. Returns a **plain array** ordered by `createdAt DESC`.

**Query params:**
```
skip   integer   Records to skip (default 0)
take   integer   Records to return (default 10, max 50)
```

**Response `200`:** Plain array of review objects:
```json
[
  {
    "id": "90000000-0000-4000-8000-000000000001",
    "bookingId": "60000000-0000-4000-8000-000000000004",
    "workerId": "50000000-0000-4000-8000-000000000001",
    "customerId": "40000000-0000-4000-8000-000000000002",
    "rating": 5,
    "comment": "Arrived on time and explained the wiring issue clearly.",
    "createdAt": "2026-07-09T18:00:00.000Z"
  }
]
```

---

### GET `/reviews/worker/:id` — `PUBLIC`
Get paginated reviews for a specific worker. Worker `:id` is the `WorkerProfile.id` (not `userId`).

**Query params:** `skip`, `take` (same as above)

**Response `200`:** Plain array of review objects:
```json
[
  {
    "id": "90000000-0000-4000-8000-000000000001",
    "bookingId": "60000000-0000-4000-8000-000000000004",
    "workerId": "50000000-0000-4000-8000-000000000001",
    "customerId": "40000000-0000-4000-8000-000000000002",
    "rating": 5,
    "comment": "Arrived on time and explained the wiring issue clearly.",
    "createdAt": "2026-07-09T18:00:00.000Z"
  }
]
```

> Display the worker's pre-computed `averageRating` from the worker profile object — do not compute it client-side from this list.
> Show the average rating only if `worker.totalReviews >= 3` (UI rule per BRD REV-04; the public profile endpoint enforces this server-side by returning `null`).

---

## 10. Categories & Barangays

### GET `/categories` — `PUBLIC`
List all active service categories, ordered by `sortOrder ASC`.

**Response `200`:**
```json
[
  {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Electrician",
    "slug": "electrician",
    "iconUrl": "https://example.com/icons/electrician.svg",
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  },
  {
    "id": "10000000-0000-4000-8000-000000000002",
    "name": "Plumber",
    "slug": "plumber",
    "iconUrl": "https://example.com/icons/plumber.svg",
    "isActive": true,
    "sortOrder": 2,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
]
```

---

### GET `/barangays` — `PUBLIC`
List all active barangays in the municipality, ordered alphabetically by name.

**Response `200`:**
```json
[
  {
    "id": "20000000-0000-4000-8000-000000000005",
    "name": "Batino",
    "centroidLat": null,
    "centroidLng": null
  },
  {
    "id": "20000000-0000-4000-8000-000000000001",
    "name": "Canubing I",
    "centroidLat": null,
    "centroidLng": null
  }
]
```

> `centroidLat` and `centroidLng` are `null` until the geography team populates them. Do not rely on them for MVP.
> `psgcCode` and `isActive` are **not** returned from this endpoint.

---

## 11. Notifications (Push Tokens)

Register the device's Expo push token immediately after every login so the server can deliver booking events in real time.

### POST `/notifications/push-token` — `PROTECTED`

**Request body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ANDROID"
}
```

> `platform`: `IOS` or `ANDROID`.
> If the token already exists, its `userId` and `platform` are updated (upsert).

**Response `200`:** Empty body.

---

### DELETE `/notifications/push-token` — `PROTECTED`
Remove the device's push token on logout.

**Request body:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response `200`:** Empty body.

---

## 12. Booking Lifecycle — State Machine

```
                        ┌─────────────┐
                        │   PENDING   │ ← created by customer (30-min expiry set)
                        └──────┬──────┘
              ┌────────────────┼────────────────┬──────────────────┐
              │                │                │                  │
          (accept)         (reject)         (30 min             (customer
              │                │              expires)            cancels)
              ▼                ▼                ▼                  ▼
        ┌──────────┐     ┌──────────┐     ┌─────────┐      ┌───────────┐
        │ ACCEPTED │     │ REJECTED │     │ EXPIRED │      │ CANCELLED │
        └────┬─────┘     └──────────┘     └─────────┘      └───────────┘
             │
      ┌──────┴────────────────────────────┐
      │                         │         │
   (start)                  (worker    (customer
      │                      cancels*)   cancels)
      ▼                         ▼         ▼
┌─────────────┐           ┌───────────────────┐
│ IN_PROGRESS │           │     CANCELLED     │ ← worker cancel: *strike auto-issued
└──────┬──────┘           └───────────────────┘
       │
    (complete)
       │
       ▼
┌───────────┐
│ COMPLETED │ → push notification sent → customer can submit review
└───────────┘
       │
  (customer
 reports no-show
  within active
   window*)
       │
       ▼
┌─────────────┐
│   NO_SHOW   │ ← admin confirms → strike issued; admin dismisses → booking stays COMPLETED
└─────────────┘

       ↑
  (worker reports customer no-show while ACCEPTED or IN_PROGRESS)
       │
       ▼
┌──────────────────┐
│ CUSTOMER_NO_SHOW │ ← admin confirms → booking closed; no strike. Admin dismisses → booking stays as-is.
└──────────────────┘
```

*No-show can be reported while booking is still `ACCEPTED` or `IN_PROGRESS` — not after `COMPLETED`.

**Rules summary:**
- Customer can cancel `PENDING` or `ACCEPTED` freely (no penalty, no reason required).
- Worker cancellation of `ACCEPTED`/`IN_PROGRESS` → automatic `CANCELLED` + 1 strike + cancellation reason required. At 3 strikes → `SUSPENDED`.
- `PENDING` auto-expires after 30 minutes (server cron job, no action needed client-side). Customer receives a push notification on expiry.
- `NO_SHOW` is admin-set after reviewing a customer report — the booking status changes to `NO_SHOW`.

---

## 13. Typical App Flows

### Customer: First Login (Returning User)

```
1. POST /auth/request-otp         { phone }
2. POST /auth/verify-otp          { phone, code }
   → response.type === "login"
   → store accessToken + refreshToken
3. POST /notifications/push-token { token, platform }
4. GET  /users/me                 → check customerProfile
   → if customerProfile !== null: navigate to home screen
   → if customerProfile === null: navigate to profile setup
5. POST /customers/profile        { firstName, lastName }
   → navigate to home screen
```

---

### Customer: Registration (New User)

```
1. POST /auth/request-otp         { phone }
2. POST /auth/verify-otp          { phone, code }
   → response.type === "registration"
   → show role picker screen
3. POST /auth/register            { registrationToken, role: "CUSTOMER" }
   → store accessToken + refreshToken
4. POST /notifications/push-token { token, platform }
5. POST /customers/profile        { firstName, lastName }
   → navigate to home screen
```

---

### Customer: Book a Worker

```
1. GET  /categories               → populate home grid
2. GET  /barangays                → populate location picker
3. GET  /workers/search?categoryId=<uuid>&barangayId=<uuid>&availableOnly=true&skip=0&take=10
   → show worker cards (firstName, lastName, baseRate, averageRating, categories)
4. GET  /workers/<workerId>       → open full worker profile
5. GET  /reviews/worker/<workerId>?skip=0&take=10
   → display reviews on profile screen
6. POST /bookings                 { workerId, categoryId, barangayId, ... }
   → navigate to booking detail; poll or push for status changes
7. GET  /bookings/<bookingId>     → on status=ACCEPTED, show worker.user.phone
8. POST /reviews                  { bookingId, rating, comment } ← after COMPLETED
```

---

### Worker: Registration & Onboarding (New User)

```
1. POST /auth/request-otp         { phone }
2. POST /auth/verify-otp          { phone, code }
   → response.type === "registration"
   → show role picker screen
3. POST /auth/register            { registrationToken, role: "WORKER" }
   → store accessToken + refreshToken
4. POST /notifications/push-token { token, platform }
5. POST /workers/profile          { firstName, lastName, baseRate, homeBarangayId, categories, serviceAreaBarangayIds }
   → navigate to verification screen (workerProfile.status === "PENDING")
6. POST /workers/verification     multipart: { idPhoto: File, selfie: File }
   → show "Under Review" screen; wait for admin push notification
7. PATCH /workers/availability    { isOnline: true }  ← enabled once status === "VERIFIED"
```

---

### Worker: Handle an Incoming Booking

```
Push notification received → open booking request screen

1. GET  /bookings/<bookingId>            → show customer.firstName, barangay.name, timeWindow, notes
2. PATCH /bookings/<bookingId>/accept    (or /reject)
   → on accept: navigate to booking detail — customer sees your phone
3. PATCH /bookings/<bookingId>/start     ← tap on arrival
4. PATCH /bookings/<bookingId>/complete  ← tap after job done
   → customer gets push notification to leave a review
```

---

### Token Refresh Flow (silent, background)

```
On any 401 response:
1. POST /auth/refresh             { refreshToken }
   → new { accessToken, refreshToken }
2. Store both new tokens (old refreshToken is now dead)
3. Retry the original failed request with new accessToken
4. If refresh returns 401 → force logout → navigate to phone entry screen
```

---

## 14. Admin Endpoints

All admin endpoints require `ADMIN` role. These are for the internal dashboard, not the consumer mobile app.

### PATCH `/admin/workers/:id/reinstate` — `PROTECTED (ADMIN)`
Reinstate a `SUSPENDED` worker. Resets `strikeCount` to 0 and sets `WorkerProfile.status` back to `VERIFIED`. Requires a written audit note. The `:id` is the **`WorkerProfile.id`** (not `userId`) — use the `id` returned by `GET /admin/workers`.

**Request body:**
```json
{ "auditNote": "Reviewed strikes with worker, all resolved. Cleared to return." }
```

> Returns `404` if no suspended worker exists with that profile ID.
> After reinstatement the worker must toggle online manually via `PATCH /workers/availability`.

**Response `200`:** Updated `WorkerProfile` object with `status: "VERIFIED"` and `strikeCount: 0`.

---

### GET `/admin/no-shows` — `PROTECTED (ADMIN)`
List pending worker no-show reports (filed by customers against workers) awaiting admin review.

**Query params:** `skip`, `take` (default 0 / 10)

**Response `200`:** Paginated `{ items, total, skip, take }`.

---

### PATCH `/admin/no-shows/:id/resolve` — `PROTECTED (ADMIN)`
Confirm or dismiss a worker no-show report.

**Request body:**
```json
{ "confirmed": true, "notes": "Verified via call logs." }
```

> `confirmed: true` → issues a strike to the worker and sets booking to `NO_SHOW`.
> `confirmed: false` → dismisses the report; booking stays as-is.

**Response `200`:** `{ "resolved": true, "confirmed": true }`

---

### GET `/admin/customer-no-shows` — `PROTECTED (ADMIN)`
List pending customer no-show reports (filed by workers against customers) awaiting admin review.

**Query params:** `skip`, `take` (default 0 / 10)

**Response `200`:** Paginated `{ items, total, skip, take }`.

---

### PATCH `/admin/customer-no-shows/:id/resolve` — `PROTECTED (ADMIN)`
Confirm or dismiss a customer no-show report.

**Request body:**
```json
{ "confirmed": true }
```

> `confirmed: true` → sets booking to `CUSTOMER_NO_SHOW`. No strike is issued.
> `confirmed: false` → dismisses the report; booking stays as-is.

**Response `200`:** `{ "resolved": true, "confirmed": true }`

---

### GET `/admin/reviews` — `PROTECTED (ADMIN)`
List all reviews with optional worker filter.

**Query params:**
```
workerId   UUID      Filter by worker profile ID (optional)
skip       integer   Records to skip (default 0)
take       integer   Records to return (default 10, max 50)
```

**Response `200`:** Paginated `{ items, total, skip, take }` where each item includes `worker` and `customer` name snippets.

---

### DELETE `/admin/reviews/:id` — `PROTECTED (ADMIN)`
Delete a review. Atomically recalculates the worker's `averageRating` and `totalReviews`.

**Response `200`:** `{ "deleted": true }`

---

## Notes for the Mobile Team

- **Phone format:** Always E.164: `+63` + 10 digits (e.g., `+639171234567`). No spaces or dashes.
- **UUIDs:** All IDs are UUID v4. Store and send them as plain strings.
- **Decimal fields** — `baseRate`, `rateOverride`, `agreedRate`, `averageRating`, `locationLat`, `locationLng` are returned as **decimal strings** (e.g., `"650.00"`, `"14.6001000"`). Parse to `Number` or `parseFloat` before arithmetic or map display.
- **Null vs absent** — optional fields that have no value are returned as `null` (not omitted). The exception is `worker.user` / `customer.user` on `GET /bookings/:id`: these are entirely **absent** from the response object when contact is not yet revealed.
- **Pagination** — all paginated endpoints use `skip`/`take`. None return a total count — size your UI accordingly.
- **Worker phone:** Never displayed until `booking.status === "ACCEPTED"` (or later active states). The server enforces this — the field simply won't exist in the response.
- **Rating display:** Only show `averageRating` if `worker.totalReviews >= 3`. The public worker profile endpoint enforces this by returning `null` for `averageRating` when the count is below 3.
- **Worker availability:** `isOnline: true` is only allowed when `workerProfile.status === "VERIFIED"`. The server returns `403` otherwise — gate this UI action on the worker's status.
- **Push tokens:** Register immediately after every login (the token may change between app launches). Remove on logout.
- **Multipart uploads:** Verification and credential uploads use `multipart/form-data`. Set the correct `Content-Type` boundary — most HTTP clients handle this automatically when you append files to a `FormData` object.
- **Rate limits:** OTP request is throttled at 3/15 min. Show a countdown UI after the first send to prevent user frustration.
- **Empty responses:** `PATCH /bookings/:id/accept|reject|start|complete|cancel` (the update endpoint `PATCH /bookings/:id` also returns `null`) and `POST|DELETE /notifications/push-token` all return HTTP `200` with an **empty body** — do not try to parse a JSON response.

---

*© 2026 UGNAY. Internal use only. For questions, contact the backend team.*
