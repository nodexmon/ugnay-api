import { BookingType, TimeWindow } from '@/generated/prisma/enums';

export const BOOKING_PENDING_EXPIRY_MS = 30 * 60 * 1000;
export const BOOKING_MAX_ADVANCE_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_ACCEPTED_GRACE_MS = 24 * 60 * 60 * 1000;
// Philippine Standard Time is UTC+8 (no DST). Do NOT "correct" this to -8.
export const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
export const NO_SHOW_DEADLINE_EXTRA_MS = 2 * 60 * 60 * 1000;
export const TIME_WINDOW_END_HOUR_PHT: Record<TimeWindow, number> = {
  [TimeWindow.MORNING]: 12,
  [TimeWindow.AFTERNOON]: 18,
  [TimeWindow.EVENING]: 21,
};

// Bucket a UTC instant into the start-of-day (in UTC ms) of its PHT calendar date.
export function toPhtDayMs(date: Date): number {
  const phtDate = new Date(date.getTime() + PHT_OFFSET_MS);
  return Date.UTC(
    phtDate.getUTCFullYear(),
    phtDate.getUTCMonth(),
    phtDate.getUTCDate(),
  );
}

// BR-11: bookingType is derived server-side — same PHT calendar day → IMMEDIATE.
export function deriveBookingType(scheduledDate: Date): BookingType {
  return toPhtDayMs(scheduledDate) === toPhtDayMs(new Date())
    ? BookingType.IMMEDIATE
    : BookingType.SCHEDULED;
}

export function getTimeWindowEndUtcMs(
  scheduledDate: Date,
  timeWindow: TimeWindow,
): number {
  const endHour = TIME_WINDOW_END_HOUR_PHT[timeWindow];
  return toPhtDayMs(scheduledDate) - PHT_OFFSET_MS + endHour * 60 * 60 * 1000;
}
