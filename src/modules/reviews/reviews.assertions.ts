import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus } from '@/generated/prisma/enums';
import { Booking } from '@/generated/prisma/client';

type ReviewableBooking = Pick<
  Booking,
  'id' | 'status' | 'workerId' | 'customerId'
>;

@Injectable()
export class ReviewsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async findCompletedBooking(bookingId: string): Promise<ReviewableBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, workerId: true, customerId: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException(
        'Reviews can only be submitted for completed bookings.',
      );
    }

    return booking;
  }

  assertCustomerOwnsBooking(
    customerId: string,
    customerProfileId: string,
  ): void {
    if (customerId !== customerProfileId) {
      throw new ForbiddenException(
        'Only the customer of this booking may submit a review.',
      );
    }
  }

  async findCustomerProfile(userId: string): Promise<{ id: string }> {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found.');
    }
    return profile;
  }

  async assertWorkerProfileExists(workerId: string): Promise<void> {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile not found.');
    }
  }

  async assertNoExistingReview(bookingId: string): Promise<void> {
    const existing = await this.prisma.review.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A review already exists for this booking.');
    }
  }
}
