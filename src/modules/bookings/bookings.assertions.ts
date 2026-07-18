import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Booking } from '@/generated/prisma/client';
import { BookingStatus, Role, WorkerStatus } from '@/generated/prisma/enums';
import { BOOKING_MAX_ADVANCE_MS } from '@/modules/bookings/bookings.constants';

@Injectable()
export class BookingsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  assertOwnership(entityId: string, profileId: string): void {
    if (entityId !== profileId) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }

  async findBooking(bookingId: string): Promise<Booking> {
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
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { isOnline: true, status: true },
    });

    if (
      !worker ||
      !worker.isOnline ||
      worker.status !== WorkerStatus.VERIFIED
    ) {
      throw new ForbiddenException('Worker is not available.');
    }

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

  assertScheduledDateIsValid(scheduledAt: Date): void {
    const maxScheduledDate = new Date(Date.now() + BOOKING_MAX_ADVANCE_MS);
    if (scheduledAt > maxScheduledDate) {
      throw new BadRequestException('Scheduled booking must be within 7 days.');
    }
  }

  async resolveProfileId(userId: string, role: Role): Promise<string> {
    if (role === Role.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException('Customer profile not found.');
      return profile.id;
    }
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Worker profile not found.');
    return profile.id;
  }
}
