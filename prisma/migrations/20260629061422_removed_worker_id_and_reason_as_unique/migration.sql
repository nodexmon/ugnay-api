/*
  Warnings:

  - A unique constraint covering the columns `[bookingId]` on the table `strikes` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "strikes_workerId_bookingId_reason_key";

-- CreateIndex
CREATE UNIQUE INDEX "strikes_bookingId_key" ON "strikes"("bookingId");
