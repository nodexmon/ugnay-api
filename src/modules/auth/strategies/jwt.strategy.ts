import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from '@/config';
import { AuthJwtPayload } from '../auth.types';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    config: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.JWT_SECRET,
    });
  }

  validate(payload: AuthJwtPayload) {
    if (payload.tokenId) throw new UnauthorizedException('Invalid token type.');
    return {
      sub: payload.sub,
      phone: payload.phone,
      role: payload.role,
    };
  }
}
