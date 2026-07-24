import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';
import { OTP_RETENTION_MS } from './otp/otp.constants';
import { REFRESH_TOKEN_RETENTION_MS } from './auth.constants';

@Injectable()
export class AuthCron {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {}

  // Runs at 18:00 UTC = 02:00 Asia/Manila (off-peak). All times stored in UTC.
  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async purgeExpiredAuthRecords(): Promise<void> {
    const otpCutoff = new Date(Date.now() - OTP_RETENTION_MS);
    const refreshCutoff = new Date(Date.now() - REFRESH_TOKEN_RETENTION_MS);

    try {
      const { count: otpCount } = await this.prisma.otpRequest.deleteMany({
        where: { createdAt: { lt: otpCutoff } },
      });
      this.logger.log(`Purged ${otpCount} expired OTP records`);
    } catch (err: unknown) {
      this.logger.error({ err }, 'Failed to purge expired OTP records');
    }

    try {
      const { count: tokenCount } = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: refreshCutoff } },
            { revokedAt: { lt: refreshCutoff } },
          ],
        },
      });
      this.logger.log(`Purged ${tokenCount} expired/revoked refresh tokens`);
    } catch (err: unknown) {
      this.logger.error({ err }, 'Failed to purge expired refresh tokens');
    }
  }
}
