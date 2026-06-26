-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "rejectedAt" TIMESTAMP(3);
