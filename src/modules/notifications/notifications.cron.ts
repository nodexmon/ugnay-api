import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  PUSH_RECEIPT_CRON,
  PUSH_TICKET_BATCH_SIZE,
  PUSH_TICKET_MAX_AGE_MS,
} from './notifications.constants';

@Injectable()
export class NotificationsCron {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(PUSH_RECEIPT_CRON)
  async checkPushReceipts() {
    const cutoff = new Date(Date.now() - PUSH_TICKET_MAX_AGE_MS);

    const pending = await this.prisma.pushTicket.findMany({
      take: PUSH_TICKET_BATCH_SIZE,
      select: { id: true, ticketId: true, token: true },
    });

    const resolvedIds: string[] = [];

    if (pending.length > 0) {
      const chunks = this.notifications.chunkReceiptIds(
        pending.map((t) => t.ticketId),
      );

      for (const chunk of chunks) {
        try {
          const receipts = await this.notifications.getReceipts(chunk);

          for (const ticketId of chunk) {
            const receipt = receipts[ticketId];
            if (!receipt) continue;

            if (receipt.status === 'error') {
              this.logger.warn({ ticketId, receipt }, 'Push receipt error');
              if (receipt.details?.error === 'DeviceNotRegistered') {
                const row = pending.find((t) => t.ticketId === ticketId);
                if (row) {
                  await this.prisma.pushToken
                    .deleteMany({ where: { token: row.token } })
                    .catch(() => {});
                }
              }
            }

            resolvedIds.push(ticketId);
          }
        } catch (err: unknown) {
          this.logger.error({ err }, 'Failed to fetch push receipts for chunk');
        }
      }

      if (resolvedIds.length > 0) {
        await this.prisma.pushTicket.deleteMany({
          where: { ticketId: { in: resolvedIds } },
        });
      }

      this.logger.log(
        `Push receipts: resolved ${resolvedIds.length} of ${pending.length}`,
      );
    }

    // Always age out tickets older than 24h regardless of receipt resolution.
    await this.prisma.pushTicket.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  }
}
