import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp/otp.service';
import { SmsService } from './sms/sms.service';
import { AuthJwtService } from './jwt/jwt.service';
import { Role } from '../generated/prisma/enums';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';

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

        return this.issueTokens(user.id, user.phone)
    }

    async refreshToken(refreshToken: string) {
        const payload = await this.jwtService.verifyRefreshToken(refreshToken)

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        })

        if (!user) throw new UnauthorizedException()

        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { id: payload.tokenId },
        })

        if (
            !storedToken ||
            storedToken.userId !== user.id ||
            storedToken.revokedAt ||
            storedToken.expiresAt < new Date() ||
            !this.matchesTokenHash(refreshToken, storedToken.tokenHash)
        ) {
            throw new UnauthorizedException('Invalid refresh token')
        }

        const nextRefreshTokenId = randomUUID()
        const tokens = this.jwtService.signTokens(user.id, user.phone, nextRefreshTokenId)

        await this.prisma.$transaction(async (tx) => {
            const revoked = await tx.refreshToken.updateMany({
                where: {
                    id: storedToken.id,
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            })

            if (revoked.count !== 1) throw new UnauthorizedException('Invalid refresh token')

            await tx.refreshToken.create({
                data: {
                    id: nextRefreshTokenId,
                    userId: user.id,
                    tokenHash: this.hashToken(tokens.refreshToken),
                    expiresAt: this.refreshTokenExpiryDate(),
                },
            })
        })

        return tokens
    }



    async revokeSession(userId: string, tokenId: string): Promise<void> {
        const result = await this.prisma.refreshToken.updateMany({
            where: {
                id: tokenId,    
                userId: userId,
                revokedAt: null
            },
            data: {
                revokedAt: new Date()
            }
        })

        if(result.count === 0) throw new NotFoundException("Session not found or already revoked.")
    }

    async revokeAllSessions(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: {
                userId, revokedAt: null
            },
            data: {
                revokedAt: new Date()
            }
        })

    
    }

    async getAllSessions(userId: string) {
        return this.prisma.refreshToken.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: {
                    gt: new Date()
                }
            },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {createdAt: 'desc'}
        })
    }

    private async issueTokens(userId: string, phone: string) {
        const refreshTokenId = randomUUID()
        const tokens = this.jwtService.signTokens(userId, phone, refreshTokenId)

        await this.prisma.refreshToken.create({
            data: {
                id: refreshTokenId,
                userId,
                tokenHash: this.hashToken(tokens.refreshToken),
                expiresAt: this.refreshTokenExpiryDate(),
            },
        })

        return tokens
    }

    private hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex')
    }

    private matchesTokenHash(token: string, tokenHash: string) {
        const incomingHash = this.hashToken(token)
        const incomingBuffer = Buffer.from(incomingHash)
        const storedBuffer = Buffer.from(tokenHash)

        return incomingBuffer.length === storedBuffer.length && timingSafeEqual(incomingBuffer, storedBuffer)
    }

    private refreshTokenExpiryDate() {
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
}
