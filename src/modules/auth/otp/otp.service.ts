import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import {
  OTP_EXPIRY_MS,
  OTP_HOURLY_LIMIT,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_BCRYPT_ROUNDS,
} from './otp.constants';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async createOtp(phone: string): Promise<{ id: string; code: string }> {
    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    const otp = await this.prisma.$transaction(
      async (tx: TransactionClient) => {
        const recentCount = await tx.otpRequest.count({
          where: {
            phone,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          },
        });
        if (recentCount >= OTP_HOURLY_LIMIT) {
          throw new HttpException(
            'Too many OTP requests. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // Invalidate previous OTPs for this phone
        await tx.otpRequest.updateMany({
          where: { phone, verified: false },
          data: { expiresAt: new Date() }, // expires immediately
        });

        return tx.otpRequest.create({
          data: { phone, codeHash, expiresAt },
        });
      },
    );

    return { id: otp.id, code };
  }

  async verifyOtp(phone: string, code: string): Promise<string> {
    const otp = await this.prisma.otpRequest.findFirst({
      where: {
        phone,
        verified: false,
        expiresAt: { gt: new Date() },
        attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const isMatch = await bcrypt.compare(code, otp.codeHash);

    if (!isMatch) {
      // Atomically increment — rejects the guess if the cap was reached concurrently
      const { count } = await this.prisma.otpRequest.updateMany({
        where: {
          id: otp.id,
          verified: false,
          attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
        },
        data: { attempts: { increment: 1 } },
      });
      if (count === 0) {
        throw new UnauthorizedException('Invalid or expired OTP.');
      }
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const { count } = await this.prisma.otpRequest.updateMany({
      where: {
        id: otp.id,
        verified: false,
        attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
      },
      data: { verified: true },
    });

    if (count === 0) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    return otp.id;
  }

  async consumeForRegistration(
    otpId: string,
    tx: TransactionClient,
  ): Promise<void> {
    const { count } = await tx.otpRequest.updateMany({
      where: { id: otpId, verified: true, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    if (count === 0) {
      throw new UnauthorizedException(
        'Registration session has expired or already been used.',
      );
    }
  }

  async deleteOtp(id: string): Promise<void> {
    await this.prisma.otpRequest.deleteMany({ where: { id } });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private generateOtp(): string {
    return randomInt(100_000, 1_000_000).toString();
  }
}
