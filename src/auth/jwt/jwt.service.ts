import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthJwtService {
    constructor(private jwt: JwtService) {}

    signTokens(userId: string, phone: string) {
        const payload = { sub: userId, phone }

        
        return {
            accessToken: this.jwt.sign(payload, { expiresIn: '15m' }),
            refreshToken: this.jwt.sign(payload, { expiresIn: '7d' }),
        }
    }
}
