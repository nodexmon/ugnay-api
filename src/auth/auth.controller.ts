import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthJwtPayload } from './jwt/jwt.service';
import { Public } from '../common/decorators/public-endpoint.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('request-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, dto.role);
  }

  @Post('refresh')
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Delete('sessions/:tokenId')
  async revokeSession(@CurrentUser() user: AuthJwtPayload, @Param('tokenId') tokenId: string) {
    await this.authService.revokeSession(user.sub, tokenId)
    return {
      mesage: 'Session revoked.'
    }
  }

  @Delete('sessions')
  async revokeAllSessions(@CurrentUser() user: AuthJwtPayload) {
    await this.authService.revokeAllSessions(user.sub)
    return {
      message: "All sessions revoked."
    }
  }
}
