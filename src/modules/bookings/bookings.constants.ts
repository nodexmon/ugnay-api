import { TimeWindow } from '@/generated/prisma/enums';

export const BOOKING_PENDING_EXPIRY_MS = 30 * 60 * 1000;
export const BOOKING_MAX_ADVANCE_MS = 7 * 24 * 60 * 60 * 1000;
export const PST_OFFSET_MS = 8 * 60 * 60 * 1000;
export const NO_SHOW_DEADLINE_EXTRA_MS = 2 * 60 * 60 * 1000;
export const TIME_WINDOW_END_HOUR_PST: Record<TimeWindow, number> = {
  [TimeWindow.MORNING]: 12,
  [TimeWindow.AFTERNOON]: 18,
  [TimeWindow.EVENING]: 21,
};
