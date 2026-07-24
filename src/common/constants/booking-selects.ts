export const BOOKING_PARTY_IDS_INCLUDE = {
  worker: { select: { userId: true } },
  customer: { select: { userId: true } },
} as const;

export const BOOKING_DETAIL_INCLUDE = {
  worker: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
      averageRating: true,
      baseRate: true,
      user: { select: { phone: true } },
    },
  },
  customer: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
      user: { select: { phone: true } },
    },
  },
  category: { select: { name: true, iconUrl: true } },
  barangay: { select: { name: true } },
  review: true,
} as const;
