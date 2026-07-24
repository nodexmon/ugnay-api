import type { Prisma } from '@/generated/prisma/client';
import type { BOOKING_DETAIL_INCLUDE } from '@/common/constants/booking-selects';

export type BookingDetail = Prisma.BookingGetPayload<{
  include: typeof BOOKING_DETAIL_INCLUDE;
}>;

// Contact details (each party's `user`) are only revealed once the booking is
// accepted; before that they are stripped to `undefined`.
export type BookingDetailContactMasked = Omit<
  BookingDetail,
  'worker' | 'customer'
> & {
  worker: Omit<BookingDetail['worker'], 'user'> & {
    user?: BookingDetail['worker']['user'];
  };
  customer: Omit<BookingDetail['customer'], 'user'> & {
    user?: BookingDetail['customer']['user'];
  };
};
