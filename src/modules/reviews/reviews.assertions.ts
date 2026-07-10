import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus } from '@/generated/prisma/enums';
import { Booking } from '@/generated/prisma/client';

type ReviewableBooking = Pick<Booking, 'id' | 'status' | 'workerId' | 'customerId'>;

@Injectable()
export class ReviewsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertBookingExistsAndCompleted(bookingId: string): Promise<ReviewableBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, workerId: true, customerId: true },
    });

    if (!booking) throw new NotFoundException('Booking not found.');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException(
        'Reviews can only be submitted for completed bookings.',
      );
    }

    return booking;
  }

  assertCustomerOwnsBooking(customerId: string, customerProfileId: string): void {
    if (customerId !== customerProfileId) {
      throw new ForbiddenException(
        'Only the customer of this booking may submit a review.',
      );
    }
  }
}
