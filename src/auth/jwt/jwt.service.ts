import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthJwtPayload {
    sub: string;
    phone: string;
}

@Injectable()
export class AuthJwtService {
    constructor(private jwt: JwtService) {}

    signTokens(userId: string, phone: string) {
        const payload = { sub: userId, phone }

        
        return {
            accessToken: this.jwt.sign(payload, { expiresIn: '15m' }),
            refreshToken: this.jwt.sign(payload, { expiresIn: '30d' }),
        }
    }

    async verifyRefreshToken(refreshToken: string): Promise<AuthJwtPayload> {
        try {
            return await this.jwt.verifyAsync<AuthJwtPayload>(refreshToken)
        } catch {
            throw new UnauthorizedException('Invalid refresh token')
        }
    }
}
