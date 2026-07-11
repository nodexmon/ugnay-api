import { BookingStatus } from '@/generated/prisma/enums';

export const CONTACT_REVEAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
]);

export const BOOKING_PENDING_EXPIRY_MS = 30 * 60 * 1000;
export const BOOKING_MAX_ADVANCE_MS = 7 * 24 * 60 * 60 * 1000;
