-- CreateEnum
CREATE TYPE "NoShowReportType" AS ENUM ('WORKER', 'CUSTOMER');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CUSTOMER_NO_SHOW';

-- DropIndex
DROP INDEX "no_show_reports_confirmed_idx";

-- AlterTable: add reportType with DEFAULT 'WORKER' for existing rows
ALTER TABLE "no_show_reports"
  ADD COLUMN "reportType" "NoShowReportType" NOT NULL DEFAULT 'WORKER';

-- CreateIndex
CREATE INDEX "no_show_reports_confirmed_reportType_idx" ON "no_show_reports"("confirmed", "reportType");
