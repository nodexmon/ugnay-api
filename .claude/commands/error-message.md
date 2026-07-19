Apply these rules to every exception message string you write or review. See `handle-error` for which exception type to throw.

## Core rules

1. **Always end with a period.** No exceptions.
2. **Sentence case.** Capitalise the first word only — no Title Case.
3. **Name the subject.** The client must know *what* was not found or what violated the rule.
4. **No internal details.** No table names, column names, Prisma error codes, stack traces, or internal API URLs.
5. **No vague catch-alls.** `'Something went wrong.'`, `'An error occurred.'`, `'Invalid request.'` are banned.

```typescript
// ❌
throw new NotFoundException('Not found.');          // no subject
throw new NotFoundException('User does not exist'); // no period, wrong phrasing
throw new ForbiddenException('FORBIDDEN');          // all caps, no context
throw new BadRequestException('credential file is required'); // lowercase, no period
throw new InternalServerErrorException('P2025: record not found'); // leaks Prisma code

// ✅
throw new NotFoundException('User not found.');
throw new ForbiddenException('Worker account is suspended.');
throw new BadRequestException('Credential file is required.');
throw new InternalServerErrorException('Failed to send SMS.');
```

---

## Patterns by exception type

### NotFoundException — `'{Resource} not found.'`

Name the exact resource. Never vary the phrasing.

```typescript
// ✅
throw new NotFoundException('Booking not found.');
throw new NotFoundException('Worker profile not found.');
throw new NotFoundException('Customer profile not found.');
throw new NotFoundException('Verification submission not found.');
throw new NotFoundException('No-show report not found.');

// ❌ — wrong phrasing
throw new NotFoundException('User does not exist.');     // use "not found" not "does not exist"
throw new NotFoundException('Category does not exist.'); // same
```

**Always use `not found` — never `does not exist`.**

---

### ConflictException — state or duplicate conflicts

Two sub-patterns:

```typescript
// Duplicate resource → '{Resource} already exists.'
throw new ConflictException('Worker profile already exists.');
throw new ConflictException('Customer profile already exists.');

// Already-processed state → '{Resource} has already been {past-participle}.'
throw new ConflictException('Verification submission has already been reviewed.');
throw new ConflictException('Credential has already been reviewed.');
throw new ConflictException('This report has already been resolved.');

// Race / stale state → '{Resource} is no longer {state}.'
throw new ConflictException('Booking is no longer pending.');
throw new ConflictException('Booking is no longer accepted.');

// ❌ — too vague, missing subject
throw new ConflictException('Already exists.');
throw new ConflictException('Status has changed.');
```

---

### ForbiddenException — permission and business-state blocks

Write what the rule is, not just that access is denied.

```typescript
// ✅ — explains the condition
throw new ForbiddenException('Worker must be verified before going online.');
throw new ForbiddenException('Worker account is suspended.');
throw new ForbiddenException('Reviews can only be submitted for completed bookings.');
throw new ForbiddenException('Only the customer of this booking may submit a review.');

// Acceptable for generic ownership failures where more context would leak data:
throw new ForbiddenException('Insufficient permissions.');

// ❌ — too vague when more context is safe to share
throw new ForbiddenException('Not allowed.');
throw new ForbiddenException('Access denied.');
```

---

### BadRequestException — invalid input and business constraints

Complete sentence. Subject first. Avoid starting with "The" — state it directly.

```typescript
// ✅
throw new BadRequestException('Duplicate categories are not allowed.');
throw new BadRequestException('One or more barangays are invalid or inactive.');
throw new BadRequestException('Scheduled booking must be within 7 days.');
throw new BadRequestException(`Maximum of ${MAX_ACTIVE_CREDENTIALS} active credentials allowed.`);

// File pipes — capitalise the subject, end with period:
throw new BadRequestException('Credential file is required.');
throw new BadRequestException('Credential file must be a JPEG, PNG, WEBP image, or PDF.');
throw new BadRequestException('Credential file must not exceed 5 MB.');

// ❌ — lowercase subject, no period (common in pipe classes)
throw new BadRequestException('credential file is required');
throw new BadRequestException('avatar must be a JPEG, PNG, or WEBP image');
```

---

### UnauthorizedException — auth failures

Short, focused. Capitalise the subject.

```typescript
// ✅
throw new UnauthorizedException('Invalid refresh token.');
throw new UnauthorizedException('Invalid registration token.');
throw new UnauthorizedException('Invalid or expired OTP.');
throw new UnauthorizedException('Account is inactive.');
throw new UnauthorizedException('Session is invalid.');

// ❌ — no period
throw new UnauthorizedException('Invalid refresh token');
throw new UnauthorizedException('Invalid or expired OTP');
```

---

### InternalServerErrorException — external service failures

`'Failed to {verb} {object}.'` — names the operation that failed.

```typescript
// ✅
throw new InternalServerErrorException('Failed to send SMS.');
throw new InternalServerErrorException('Failed to fetch barangays from PSGC API.');

// ❌ — too generic
throw new InternalServerErrorException('Internal error.');
throw new InternalServerErrorException('Something went wrong.');
```

---

## Dynamic messages

Template literals follow the same rules — the final character inside the string must be a period.

```typescript
// ✅
throw new BadRequestException(`Duplicate ${label} are not allowed.`);
throw new BadRequestException(`Maximum of ${MAX_ACTIVE_CREDENTIALS} active credentials allowed.`);
throw new ForbiddenException(
  `Booking must be in status: ${allowed.join(', ')}.`,
);

// ❌ — no period
throw new BadRequestException(`Duplicate ${label} are not allowed`);
```

---

## Quick-reference checklist

Before committing any `throw new XxxException(...)`:

- [ ] Message ends with `.`
- [ ] First word is capitalised; no other words are unless they're proper nouns
- [ ] Subject is named (not just "Not found." or "Invalid.")
- [ ] No Prisma error codes, DB column names, or internal URLs
- [ ] Phrasing matches the pattern for this exception type (see above)
- [ ] `not found` used for missing resources (not `does not exist`)
