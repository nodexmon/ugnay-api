import { BookingStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import {
  STALE_ACCEPTED_GRACE_MS,
  getTimeWindowEndUtcMs,
} from '@/modules/bookings/bookings.constants';

@Injectable()
export class BookingsCron {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expiredPendingBookings() {
    const candidates = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING, expiresAt: { lt: new Date() } },
      take: 100,
      select: { id: true, customer: { select: { userId: true } } },
    });

    if (candidates.length === 0) return;

    await this.prisma.booking.updateMany({
      where: {
        id: { in: candidates.map((b) => b.id) },
        status: BookingStatus.PENDING,
      },
      data: { status: BookingStatus.EXPIRED },
    });

    // Re-query to notify only bookings that are actually now EXPIRED.
    // Any booking accepted between the findMany and updateMany skips notification.
    const confirmedExpired = await this.prisma.booking.findMany({
      where: {
        id: { in: candidates.map((b) => b.id) },
        status: BookingStatus.EXPIRED,
      },
      select: { id: true, customer: { select: { userId: true } } },
    });

    this.logger.log(`Expired ${confirmedExpired.length} pending bookings`);

    await Promise.all(
      confirmedExpired.map((booking) =>
        this.notifications
          .sendToUser(booking.customer.userId, {
            title: 'Booking expired',
            body: 'Your booking request was not responded to in time.',
          })
          .catch(() => {}),
      ),
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cancelStaleAcceptedBookings() {
    const now = Date.now();
    const cutoff = new Date(now - STALE_ACCEPTED_GRACE_MS);

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        scheduledDate: { lt: cutoff },
        noShowReport: null,
      },
      take: 100,
      select: {
        id: true,
        scheduledDate: true,
        timeWindow: true,
        customer: { select: { userId: true } },
        worker: { select: { userId: true } },
      },
    });

    if (candidates.length === 0) return;

    // Precise filter: the booking window must have ended more than GRACE_MS ago.
    const stale = candidates.filter(
      (b) =>
        now >
        getTimeWindowEndUtcMs(b.scheduledDate, b.timeWindow) +
          STALE_ACCEPTED_GRACE_MS,
    );

    if (stale.length === 0) return;

    await this.prisma.booking.updateMany({
      where: {
        id: { in: stale.map((b) => b.id) },
        status: BookingStatus.ACCEPTED,
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationActor: 'SYSTEM',
        cancelledAt: new Date(),
        cancellationReason:
          'Booking was automatically cancelled because it was never started.',
      },
    });

    const confirmedCancelled = await this.prisma.booking.findMany({
      where: {
        id: { in: stale.map((b) => b.id) },
        status: BookingStatus.CANCELLED,
      },
      select: {
        id: true,
        customer: { select: { userId: true } },
        worker: { select: { userId: true } },
      },
    });

    this.logger.log(
      `Auto-cancelled ${confirmedCancelled.length} stale accepted bookings`,
    );

    for (const booking of confirmedCancelled) {
      void this.notifications
        .sendToUser(booking.customer.userId, {
          title: 'Booking cancelled',
          body: 'Your booking was automatically cancelled because it was never started.',
        })
        .catch(() => {});

      void this.notifications
        .sendToUser(booking.worker.userId, {
          title: 'Booking cancelled',
          body: 'A booking was automatically cancelled because it was never started.',
        })
        .catch(() => {});
    }
  }
}
