-- Partial unique index: enforce one active booking per worker at the DB level.
-- Prevents TOCTOU race condition where two simultaneous booking requests for the
-- same worker both pass the application-layer availability check.
CREATE UNIQUE INDEX "one_active_booking_per_worker"
  ON "bookings"("workerId")
  WHERE "status" IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS');
