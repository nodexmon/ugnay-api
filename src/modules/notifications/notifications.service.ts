import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Platform } from '@/generated/prisma/enums';
import { Logger } from 'nestjs-pino';
import { PushMessage } from './notifications.types';
import Expo, {
  ExpoPushMessage,
  ExpoPushReceiptId,
  ExpoPushTicket,
} from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });

    if (tokens.length === 0) return;

    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token));

    const messages: ExpoPushMessage[] = validTokens.map((t) => ({
      to: t.token,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
    }));

    if (messages.length === 0) return;

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);

        const okTickets: { ticketId: string; token: string }[] = [];

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const token = (chunk[i] as { to: string }).to;

          if (ticket.status === 'error') {
            this.logger.warn({ ticket }, 'Expo push notification error');
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await this.prisma.pushToken
                .deleteMany({ where: { token } })
                .catch(() => {});
            }
          } else {
            okTickets.push({ ticketId: ticket.id, token });
          }
        }

        if (okTickets.length > 0) {
          await this.prisma.pushTicket
            .createMany({
              data: okTickets.map(({ ticketId, token }) => ({
                ticketId,
                token,
              })),
              skipDuplicates: true,
            })
            .catch(() => {});
        }
      }
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'Failed to send push notification');
    }
  }

  async registerToken(
    userId: string,
    token: string,
    platform: Platform,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      throw new UnprocessableEntityException('Invalid Expo push token.');
    }

    const existing = await this.prisma.pushToken.findUnique({
      where: { token },
    });
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException(
        'Push token is already registered to another account.',
      );
    }

    await this.prisma.pushToken.upsert({
      where: { token },
      update: { platform },
      create: { userId, token, platform },
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  getReceipts(
    ids: ExpoPushReceiptId[],
  ): ReturnType<typeof this.expo.getPushNotificationReceiptsAsync> {
    return this.expo.getPushNotificationReceiptsAsync(ids);
  }

  chunkReceiptIds(ids: ExpoPushReceiptId[]): ExpoPushReceiptId[][] {
    return this.expo.chunkPushNotificationReceiptIds(ids);
  }
}
