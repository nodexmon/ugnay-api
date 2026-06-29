/*
  Warnings:

  - A unique constraint covering the columns `[workerId,bookingId,reason]` on the table `strikes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "strikes_workerId_bookingId_reason_key" ON "strikes"("workerId", "bookingId", "reason");
