-- DropForeignKey
ALTER TABLE "no_show_reports" DROP CONSTRAINT "no_show_reports_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_bookingId_fkey";

-- CreateIndex
CREATE INDEX "worker_categories_workerId_idx" ON "worker_categories"("workerId");

-- CreateIndex
CREATE INDEX "worker_service_areas_workerId_idx" ON "worker_service_areas"("workerId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
