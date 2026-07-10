import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { randomInt } from 'crypto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  async createOtp(phone: string) {
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.$transaction(async (tx: TransactionClient) => {
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
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    return otp;
  }

  private generateOtp(): string {
    return randomInt(100_000, 999_999).toString();
  }
}
