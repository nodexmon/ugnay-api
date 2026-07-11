import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Booking } from '@/generated/prisma/client';
import { BookingStatus } from '@/generated/prisma/enums';

@Injectable()
export class BookingsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  assertOwnership(entityId: string, profileId: string): void {
    if (entityId !== profileId) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }

  async assertBookingExists(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  assertBookingInStatus(
    status: BookingStatus,
    ...allowed: BookingStatus[]
  ): void {
    if (!allowed.includes(status)) {
      throw new ForbiddenException(
        `Booking must be in status: ${allowed.join(', ')}`,
      );
    }
  }

  async assertNoReportExists(bookingId: string): Promise<void> {
    const existingReport = await this.prisma.noShowReport.findUnique({
      where: { bookingId },
    });
    if (existingReport) {
      throw new ForbiddenException(
        'A no-show report already exists for this booking.',
      );
    }
  }

  async assertWorkerIsAvailable(workerId: string): Promise<void> {
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        workerId,
        status: { in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS] },
      },
    });
    if (activeBooking) {
      throw new ForbiddenException('Worker is currently unavailable.');
    }
  }
}
