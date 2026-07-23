-- Prevent a worker from having more than one active booking at a time.
-- The application-level check in assertWorkerIsAvailable has a TOCTOU window;
-- this constraint is the authoritative enforcement layer.
CREATE UNIQUE INDEX "booking_worker_active_unique"
  ON "bookings"("workerId")
  WHERE "status" IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS');
