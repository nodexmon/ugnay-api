import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { randomInt } from 'crypto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { OTP_EXPIRY_MS, OTP_HOURLY_LIMIT } from './otp.constants';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  async createOtp(phone: string) {
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.prisma.$transaction(async (tx: TransactionClient) => {
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

      // Invalid previous OTPs for this phone
      await tx.otpRequest.updateMany({
        where: { phone, verified: false },
        data: { expiresAt: new Date() }, // expires immediately
      });

      await tx.otpRequest.create({
        data: {
          phone,
          code,
          expiresAt,
        },
      });
    });

    return code;
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const otp = await this.assertValidOtp(phone, code);

    await this.prisma.otpRequest.update({
      where: {
        id: otp.id,
      },
      data: {
        verified: true,
      },
    });

    return true;
  }

  private async assertValidOtp(phone: string, code: string) {
    const otp = await this.prisma.otpRequest.findFirst({
      where: {
        phone,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    return otp;
  }

  private generateOtp(): string {
    return randomInt(100_000, 999_999).toString();
  }
}
