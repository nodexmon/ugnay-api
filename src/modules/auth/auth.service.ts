import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { jwtConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Role } from '@/generated/prisma/enums';
import { randomUUID } from 'crypto';
import { Prisma } from '@/generated/prisma/client';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import ms from 'ms';
import type { VerifyOtpResult } from '@/modules/auth/auth.types';
import { AuthAssertions } from '@/modules/auth/auth.assertions';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly jwtService: AuthJwtService,
    private readonly assertions: AuthAssertions,
    private readonly logger: Logger,
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async sendOtp(phone: string) {
    const { id, code } = await this.otpService.createOtp(phone);

    try {
      await this.smsService.sendSms(
        phone,
        `Your OTP code is ${code}. Do not share this to anyone.`,
      );
    } catch (err) {
      // The undelivered OTP must not count toward the hourly quota.
      await this.otpService.deleteOtp(id).catch(() => {});
      throw err;
    }

    return {
      message: `OTP has been sent to ${phone}`,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    await this.otpService.verifyOtp(phone, code);

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      this.assertions.assertUserCanAuthenticate(existingUser);
      const tokens = await this.issueTokens(
        existingUser.id,
        existingUser.phone,
        existingUser.role,
      );
      return { type: 'login', ...tokens };
    }

    const registrationToken = this.jwtService.signRegistrationToken(phone);
    return { type: 'registration', registrationToken };
  }

  async register(registrationToken: string, role: Role) {
    const payload =
      await this.jwtService.verifyRegistrationToken(registrationToken);
    const phone = payload.sub;

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('Phone number already registered.');
    }

    const user = await this.prisma.user.create({ data: { phone, role } });
    return this.issueTokens(user.id, user.phone, user.role);
  }

  async refreshToken(refreshToken: string) {
    const payload = await this.jwtService.verifyRefreshToken(refreshToken);

    const user = await this.assertions.findUserForRefresh(payload.sub);
    this.assertions.assertUserCanAuthenticate(user);

    const storedToken = await this.assertions.findRefreshToken(payload.tokenId);

    if (this.assertions.isTokenReuse(storedToken, refreshToken)) {
      await this.revokeTokensWhere({ userId: user.id, revokedAt: null });
      this.logger.warn(
        { userId: user.id },
        'Refresh token reuse detected — all sessions revoked',
      );
      throw new UnauthorizedException('Session is invalid.');
    }

    this.assertions.assertTokenIsValid(user.id, storedToken, refreshToken);

    const nextRefreshTokenId = randomUUID();
    const tokens = this.jwtService.signTokens(
      user.id,
      user.phone,
      user.role,
      nextRefreshTokenId,
    );

    await this.prisma.$transaction(async (tx: TransactionClient) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Session is invalid.');
      }

      await tx.refreshToken.create({
        data: {
          id: nextRefreshTokenId,
          userId: user.id,
          tokenHash: this.assertions.hashToken(tokens.refreshToken),
          expiresAt: this.refreshTokenExpiryDate(),
        },
      });
    });

    return tokens;
  }

  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const { count } = await this.revokeTokensWhere({
      id: tokenId,
      userId,
      revokedAt: null,
    });
    if (count === 0) {
      throw new NotFoundException('Session not found or already revoked.');
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.revokeTokensWhere({ userId, revokedAt: null });
  }

  async getAllSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private async issueTokens(userId: string, phone: string, role: Role) {
    const refreshTokenId = randomUUID();
    const tokens = this.jwtService.signTokens(
      userId,
      phone,
      role,
      refreshTokenId,
    );

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        tokenHash: this.assertions.hashToken(tokens.refreshToken),
        expiresAt: this.refreshTokenExpiryDate(),
      },
    });

    return tokens;
  }

  private refreshTokenExpiryDate() {
    return new Date(Date.now() + ms(this.config.JWT_REFRESH_EXPIRES_IN));
  }

  private async revokeTokensWhere(where: Prisma.RefreshTokenWhereInput) {
    return this.prisma.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    });
  }
}
