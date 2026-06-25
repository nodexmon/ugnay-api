import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OtpService {
    constructor(private prisma: PrismaService) {}

    private generateOtp(): string {
        return Math.floor(100_000 + Math.random() * 900_000).toString()
    }

    async createOtp(phone: string) {
        const code = this.generateOtp()

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

        await this.prisma.otpRequest.create({
            data: {
                phone,
                code,
                expiresAt,
            }
        })

        return code
    }

    async verifyOtp(phone: string, code: string): Promise<boolean> {
        const otp = await this.prisma.otpRequest.findFirst({
            where: {
                phone,
                code,
                verified: false
            }
        })

        if(!otp) {
            throw new UnauthorizedException("Invalid OTP")
        }
        
        if(otp.expiresAt < new Date()) {
            throw new UnauthorizedException("OTP expired")
        }

        await this.prisma.otpRequest.update({
            where: {
                id: otp.id
            },
            data: {
                verified: true
            }
        })

        return true
    }
}
