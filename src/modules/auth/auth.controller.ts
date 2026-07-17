import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle, ThrottlerOptions } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '@/modules/auth/auth.service';
import { SendOtpDto } from '@/modules/auth/dto/send-otp.dto';
import { VerifyOtpDto } from '@/modules/auth/dto/verify-otp.dto';
import { RefreshTokenDto } from '@/modules/auth/dto/refresh-token.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

const OTP_REQUEST_THROTTLE: ThrottlerOptions = { limit: 3, ttl: 900000 };
const OTP_VERIFY_THROTTLE: ThrottlerOptions = { limit: 5, ttl: 900000 };
const REFRESH_THROTTLE: ThrottlerOptions = { limit: 10, ttl: 3600000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: OTP_REQUEST_THROTTLE })
  @Post('request-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: OTP_VERIFY_THROTTLE })
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @Throttle({ default: OTP_VERIFY_THROTTLE })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.registrationToken, dto.role);
  }

  @Public()
  @Throttle({ default: REFRESH_THROTTLE })
  @Post('refresh')
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Delete('sessions/:tokenId')
  async revokeSession(
    @CurrentUser() user: AuthJwtPayload,
    @Param('tokenId') tokenId: string,
  ) {
    await this.authService.revokeSession(user.sub, tokenId);
    return {
      message: 'Session revoked.',
    };
  }

  @Delete('sessions')
  async revokeAllSessions(@CurrentUser() user: AuthJwtPayload) {
    await this.authService.revokeAllSessions(user.sub);
    return {
      message: 'All sessions revoked.',
    };
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: AuthJwtPayload) {
    return this.authService.getAllSessions(user.sub);
  }
}
