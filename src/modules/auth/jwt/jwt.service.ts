import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { Role } from '@/generated/prisma/enums';
import type { SignedTokens, RefreshTokenPayload } from '@/modules/auth/auth.types';

@Injectable()
export class AuthJwtService {
  constructor(private jwt: JwtService) {}

  signTokens(userId: string, phone: string, role: Role, refreshTokenId: string): SignedTokens {
    const payload: AuthJwtPayload = { sub: userId, phone, role };
    const refreshPayload = { ...payload, tokenId: refreshTokenId };

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwt.sign(refreshPayload, { expiresIn: '30d' }),
    };
  }

  async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AuthJwtPayload>(refreshToken);

      if (!payload.tokenId) throw new UnauthorizedException('Invalid refresh token');

      return payload as AuthJwtPayload & { tokenId: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
