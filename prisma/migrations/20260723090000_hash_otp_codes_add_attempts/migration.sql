-- Store OTP codes as SHA-256 hashes and track failed verification attempts.
ALTER TABLE "otp_requests" RENAME COLUMN "code" TO "codeHash";
ALTER TABLE "otp_requests" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- In-flight plaintext codes can never match a hash; expire them so users simply re-request.
UPDATE "otp_requests" SET "expiresAt" = now() WHERE "verified" = false AND "expiresAt" > now();
