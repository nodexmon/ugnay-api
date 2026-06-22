import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp/otp.service';
import { SmsService } from './sms/sms.service';
import { AuthJwtService } from './jwt/jwt.service';
import { Role } from '../generated/prisma/enums';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private otpService: OtpService,
        private smsService: SmsService,
        private jwtService: AuthJwtService
    ) {}

    async sendOtp(phone: string) {
        const code = await this.otpService.createOtp(phone)

        await this.smsService.sendSms(phone, `Your OTP code is ${code}. Do not share this to anyone.`)

        return {
            message: `OTP has been sent to ${phone}`
        }
    }

    async verifyOtp(phone: string, code: string) {
        const valid = await this.otpService.verifyOtp(phone, code)

        if(!valid) throw new UnauthorizedException()

        let user = await this.prisma.user.findUnique({
            where:{phone}
        })

        if(!user) {
            user = await this.prisma.user.create({
                data: {
                    phone,
                    role: Role.WORKER
                }   
            })
        }

        return this.jwtService.signTokens(user.id, user.phone)
    }
}
