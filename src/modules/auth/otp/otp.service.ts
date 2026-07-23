import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createHash, randomInt } from 'crypto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import {
  OTP_EXPIRY_MS,
  OTP_HOURLY_LIMIT,
  OTP_MAX_VERIFY_ATTEMPTS,
} from './otp.constants';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async createOtp(phone: string): Promise<{ id: string; code: string }> {
    const code = this.generateOtp();
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
          data: {
            phone,
            codeHash: this.hashCode(code),
            expiresAt,
          },
        });
      },
    );

    return { id: otp.id, code };
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
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

    if (otp.codeHash !== this.hashCode(code)) {
      await this.prisma.otpRequest.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
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

    return true;
  }

  async deleteOtp(id: string): Promise<void> {
    await this.prisma.otpRequest.deleteMany({ where: { id } });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private generateOtp(): string {
    return randomInt(100_000, 999_999).toString();
  }
}
