import { BookingStatus, Role } from '@/generated/prisma/enums';
import { BookingAction } from './booking.types';

export const ROLE_REQUIREMENTS: Partial<Record<BookingAction, Role>> = {
  [BookingAction.CREATE]: Role.CUSTOMER,
  [BookingAction.UPDATE]: Role.CUSTOMER,
  [BookingAction.REPORT_NO_SHOW]: Role.CUSTOMER,
  [BookingAction.ACCEPT]: Role.WORKER,
  [BookingAction.START]: Role.WORKER,
  [BookingAction.COMPLETE]: Role.WORKER,
  [BookingAction.REJECT]: Role.WORKER,
};

export const CONTACT_REVEAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
]);
