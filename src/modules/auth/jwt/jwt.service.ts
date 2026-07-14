import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { jwtConfig } from '@/config';
import { Role } from '@/generated/prisma/enums';
import type {
  SignedTokens,
  RefreshTokenPayload,
  RegistrationTokenPayload,
} from '@/modules/auth/auth.types';

@Injectable()
export class AuthJwtService {
  constructor(
    private jwt: JwtService,
    @Inject(jwtConfig.KEY) private config: ConfigType<typeof jwtConfig>,
  ) {}

  signTokens(
    userId: string,
    phone: string,
    role: Role,
    refreshTokenId: string,
  ): SignedTokens {
    const payload: AuthJwtPayload = { sub: userId, phone, role };
    const refreshPayload = { ...payload, tokenId: refreshTokenId };

    return {
      accessToken: this.jwt.sign(payload, {
        expiresIn: this.config.JWT_ACCESS_EXPIRES_IN,
      }),
      refreshToken: this.jwt.sign(refreshPayload, {
        expiresIn: this.config.JWT_REFRESH_EXPIRES_IN,
      }),
    };
  }

  async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AuthJwtPayload>(refreshToken);

      if (!payload.tokenId)
        throw new UnauthorizedException('Invalid refresh token');

      return payload as AuthJwtPayload & { tokenId: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  signRegistrationToken(phone: string): string {
    return this.jwt.sign(
      { sub: phone, purpose: 'registration' },
      { expiresIn: this.config.JWT_REGISTRATION_EXPIRES_IN },
    );
  }

  async verifyRegistrationToken(token: string): Promise<RegistrationTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RegistrationTokenPayload>(token);

      if (payload.purpose !== 'registration') {
        throw new UnauthorizedException('Invalid registration token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid registration token');
    }
  }
}
