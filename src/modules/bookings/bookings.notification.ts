import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BookingsNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  notify(
    bookingId: string,
    party: 'worker' | 'customer',
    message: { title: string; body: string },
  ) {
    void this.resolveAndNotify(bookingId, party, message).catch(() => {});
  }

  private async resolveAndNotify(
    bookingId: string,
    party: 'worker' | 'customer',
    message: { title: string; body: string },
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        worker: { select: { userId: true } },
        customer: { select: { userId: true } },
      },
    });

    if (!booking) return;

    const userId =
      party === 'worker' ? booking.worker.userId : booking.customer.userId;

    await this.notifications.sendToUser(userId, message);
  }
}
