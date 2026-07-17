-- DropIndex
DROP INDEX "otp_requests_expiresAt_idx";

-- DropIndex
DROP INDEX "otp_requests_phone_idx";

-- CreateIndex
CREATE INDEX "otp_requests_phone_verified_expiresAt_idx" ON "otp_requests"("phone", "verified", "expiresAt");
