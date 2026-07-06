import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { jwtConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Role, UserStatus } from '@/generated/prisma/enums';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma, RefreshToken, User } from '@/generated/prisma/client';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import ms from 'ms';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private otpService: OtpService,
        private smsService: SmsService,
        private jwtService: AuthJwtService,
        @Inject(jwtConfig.KEY) private config: ConfigType<typeof jwtConfig>,
    ) {}

    async sendOtp(phone: string) {
        const code = await this.otpService.createOtp(phone)

        await this.smsService.sendSms(phone, `Your OTP code is ${code}. Do not share this to anyone.`)

        return {
            message: `OTP has been sent to ${phone}`
        }
    }

    async verifyOtp(phone: string, code: string, role: Role) {
        await this.otpService.verifyOtp(phone, code)

        const existingUser = await this.prisma.user.findUnique({ where: { phone} })

        if(existingUser) {
            this.assertUserRoleMatches(existingUser.role, role)

            return this.issueTokens(
                existingUser.id,
                existingUser.phone, 
                existingUser.role
            )
        }

        const user = await this.prisma.user.upsert({
            where: { phone },
            update: { },
            create: { phone, role }
        })

        this.assertUserRoleMatches(user.role, role)
        
        return this.issueTokens(user.id, user.phone, user.role)

    }
    
    async refreshToken(refreshToken: string) {
        const payload = await this.jwtService.verifyRefreshToken(refreshToken)
        
        const user = await this.assertUserExists(payload.sub)
        this.assertUserCanAuthenticate(user)
        
        const storedToken = await this.assertRefreshTokenExists(payload.tokenId)
        this.assertTokenIsValid(user.id, storedToken, refreshToken)
        
        const nextRefreshTokenId = randomUUID()
        const tokens = this.jwtService.signTokens(
            user.id,
            user.phone, 
            user.role, 
            nextRefreshTokenId
        )
        
        await this.prisma.$transaction(async (tx: TransactionClient) => {
            const revoked = await tx.refreshToken.updateMany({
                where: {
                    id: storedToken.id,
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            })
            
            if (revoked.count !== 1) {
                throw new UnauthorizedException('Invalid refresh token')
            }

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
        const result = await this.revokeTokensWhere({ id: tokenId, userId, revokedAt: null });
        if (result.count === 0) {
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
                    gt: new Date()
                }
            },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        })
    }
    
    private async issueTokens(userId: string, phone: string, role: Role) {
        const refreshTokenId = randomUUID()
        const tokens = this.jwtService.signTokens(userId, phone, role, refreshTokenId)
        
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
    
    private async assertUserExists(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        
        if(!user) {
            throw new UnauthorizedException("Invalid refresh token.")
        }
        return user
    }
    
    private assertTokenIsValid(userId: string, storedToken: RefreshToken, refreshToken: string) {
        if (
            storedToken.userId !== userId ||
            storedToken.revokedAt ||
            storedToken.expiresAt < new Date() ||
            !this.matchesTokenHash(refreshToken, storedToken.tokenHash)
        ) {
            throw new UnauthorizedException('Invalid refresh token')
        }
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
        return new Date(Date.now() + ms(this.config.JWT_REFRESH_EXPIRES_IN))
    }
    
    private assertUserRoleMatches(existingRole: Role, requestedRole: Role) {
        if(existingRole !== requestedRole) {
            throw new ConflictException("Phone number is already registered with a different role.")
        }
    }
    
    private assertUserCanAuthenticate(user: User) {
            if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Account is inactive')
        }
    }

    private async assertRefreshTokenExists(tokenId: string) {
        const token = await this.prisma.refreshToken.findUnique({ where: { id: tokenId } })

        if(!token) {
            throw new UnauthorizedException("Invalid refresh token.")
        }

        return token
    }

    private async revokeTokensWhere(where: Prisma.RefreshTokenWhereInput) {
        return this.prisma.refreshToken.updateMany({ where, data: { revokedAt: new Date() } });
    }
}
