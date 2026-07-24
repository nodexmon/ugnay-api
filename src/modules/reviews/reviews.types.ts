import type { Prisma } from '@/generated/prisma/client';

export type PublicReview = Prisma.ReviewGetPayload<{
  select: {
    id: true;
    workerId: true;
    bookingId: true;
    rating: true;
    comment: true;
    createdAt: true;
  };
}>;
