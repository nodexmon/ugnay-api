import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp/otp.service';
import { AuthJwtService } from './jwt/jwt.service';
import { SmsService } from './sms/sms.service';
import { JwtModule } from '@nestjs/jwt';
import { JWT_CONSTANTS } from './constants';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_CONSTANTS.secret,
      signOptions: {expiresIn: '15m'}
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, AuthJwtService, SmsService],
})
export class AuthModule {}
