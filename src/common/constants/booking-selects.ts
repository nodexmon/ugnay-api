export const BOOKING_PARTY_IDS_INCLUDE = {
  worker: { select: { userId: true } },
  customer: { select: { userId: true } },
} as const;
