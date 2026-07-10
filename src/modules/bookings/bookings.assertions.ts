import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus, Role } from '@/generated/prisma/enums';
import { Booking } from '@/generated/prisma/client';
import { BookingAction } from './booking.types';
import { ROLE_REQUIREMENTS } from './bookings.constants';

@Injectable()
export class BookingsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  assertOwnership(entityId: string, profileId: string): void {
    if (entityId !== profileId) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }

  assertRole(role: Role, action: BookingAction): void {
    const required = ROLE_REQUIREMENTS[action];
    if (required && role !== required) {
      throw new ForbiddenException('Insufficient Permissions.');
    }
  }

  assertBookingInStatus(status: BookingStatus, ...allowed: BookingStatus[]): void {
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
      throw new ForbiddenException('Worker is currently unavailable');
    }
  }
}
