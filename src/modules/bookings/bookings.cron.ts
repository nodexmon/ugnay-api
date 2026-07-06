import { BookingStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';

@Injectable()
export class BookingsCron {
    constructor(
        private readonly logger: Logger,
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async expiredPendingBookings() {
        const expiredBookings = await this.prisma.booking.findMany({
            where: { status: BookingStatus.PENDING, expiresAt: { lt: new Date() } },
            include: { customer: { select: { userId: true } } },
        });

        if (expiredBookings.length === 0) return;

        this.logger.log(`Expiring ${expiredBookings.length} pending bookings`);

        await this.prisma.booking.updateMany({
            where: { id: { in: expiredBookings.map((b) => b.id) } },
            data: { status: BookingStatus.EXPIRED },
        });

        await Promise.all(
            expiredBookings.map((booking) =>
                this.notifications
                    .sendToUser(booking.customer.userId, {
                        title: 'Booking expired',
                        body: 'Your booking request was not responded to in time.',
                    })
                    .catch(() => {}),
            ),
        );
    }
}
