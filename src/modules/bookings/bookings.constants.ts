import { BookingStatus, Role } from '@/generated/prisma/enums';
import { BookingAction } from './booking.types';
export const CONTACT_REVEAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
]);
