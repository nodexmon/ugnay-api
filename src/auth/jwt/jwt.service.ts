import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthJwtPayload {
    sub: string;
    phone: string;
    tokenId?: string;
    iat?: number,
    exp?: number
}

@Injectable()
export class AuthJwtService {
    constructor(private jwt: JwtService) {}

    signTokens(userId: string, phone: string, refreshTokenId: string) {
        const payload = { sub: userId, phone }
        const refreshPayload = { ...payload, tokenId: refreshTokenId }

        
        return {
            accessToken: this.jwt.sign(payload, { expiresIn: '15m' }),
            refreshToken: this.jwt.sign(refreshPayload, { expiresIn: '30d' }),
        }
    }

    async verifyRefreshToken(refreshToken: string): Promise<AuthJwtPayload & { tokenId: string }> {
        try {
            const payload = await this.jwt.verifyAsync<AuthJwtPayload>(refreshToken)

            if (!payload.tokenId) throw new UnauthorizedException('Invalid refresh token')

            return payload as AuthJwtPayload & { tokenId: string }
        } catch {
            throw new UnauthorizedException('Invalid refresh token')
        }
    }
}
