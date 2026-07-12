-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('LICENSE', 'CERTIFICATION', 'TRAINING');

-- CreateTable
CREATE TABLE "worker_credentials" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "type" "CredentialType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worker_credentials_status_idx" ON "worker_credentials"("status");

-- CreateIndex
CREATE INDEX "worker_credentials_workerId_idx" ON "worker_credentials"("workerId");

-- AddForeignKey
ALTER TABLE "worker_credentials" ADD CONSTRAINT "worker_credentials_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
