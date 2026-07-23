import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Booking } from '@/generated/prisma/client';
import {
  BookingStatus,
  Role,
  TimeWindow,
  UserStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import {
  BOOKING_MAX_ADVANCE_MS,
  NO_SHOW_DEADLINE_EXTRA_MS,
  PST_OFFSET_MS,
  getTimeWindowEndUtcMs,
} from '@/modules/bookings/bookings.constants';

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
      select: {
        isOnline: true,
        status: true,
        user: { select: { status: true } },
      },
    });

    if (
      !worker ||
      !worker.isOnline ||
      worker.status !== WorkerStatus.VERIFIED ||
      worker.user.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException('Worker is not available.');
    }

    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        workerId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.ACCEPTED,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
    });
    if (activeBooking) {
      throw new UnprocessableEntityException(
        'Worker is currently unavailable.',
      );
    }
  }

  assertScheduledDateIsValid(scheduledAt: Date): void {
    const toDayMs = (d: Date) => {
      const p = new Date(d.getTime() + PST_OFFSET_MS);
      return Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
    };
    if (toDayMs(scheduledAt) < toDayMs(new Date())) {
      throw new UnprocessableEntityException(
        'Scheduled date cannot be in the past.',
      );
    }
    const maxScheduledDate = new Date(Date.now() + BOOKING_MAX_ADVANCE_MS);
    if (scheduledAt > maxScheduledDate) {
      throw new BadRequestException('Scheduled booking must be within 7 days.');
    }
  }

  assertNoShowWindowOpen(booking: {
    scheduledDate: Date;
    timeWindow: TimeWindow;
  }): void {
    const windowEndUTC = getTimeWindowEndUtcMs(
      booking.scheduledDate,
      booking.timeWindow,
    );
    const deadlineUTC = windowEndUTC + NO_SHOW_DEADLINE_EXTRA_MS;
    if (Date.now() < windowEndUTC) {
      throw new UnprocessableEntityException(
        'No-show report can only be submitted after the booking window has ended.',
      );
    }
    if (Date.now() > deadlineUTC) {
      throw new ForbiddenException('No-show report window has closed.');
    }
  }

  async findWorkerCategoryRate(workerId: string, categoryId: string) {
    const wc = await this.prisma.workerCategory.findUnique({
      where: { workerId_categoryId: { workerId, categoryId } },
      select: { rateOverride: true, worker: { select: { baseRate: true } } },
    });
    if (!wc) {
      throw new UnprocessableEntityException(
        'Worker does not offer the requested service category.',
      );
    }
    return wc.rateOverride ?? wc.worker.baseRate;
  }

  async assertWorkerServesBarangay(
    workerId: string,
    barangayId: string,
  ): Promise<void> {
    const area = await this.prisma.workerServiceArea.findUnique({
      where: { workerId_barangayId: { workerId, barangayId } },
      select: { id: true },
    });
    if (!area) {
      throw new UnprocessableEntityException(
        'Worker does not serve the requested barangay.',
      );
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
