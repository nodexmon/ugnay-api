import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Platform } from '@/generated/prisma/enums';
import { Logger } from 'nestjs-pino';
import { PushMessage } from './notifications.types';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

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

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
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
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn({ ticket }, 'Expo push notification error');
          }
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
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }
}
