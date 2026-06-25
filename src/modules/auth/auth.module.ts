import { Module } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { JwtModule } from '@nestjs/jwt';
import { JWT_CONSTANTS } from '@/modules/auth/constants';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_CONSTANTS.secret,
      signOptions: {expiresIn: '15m'}
    }),
    PrismaModule
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, AuthJwtService, SmsService, JwtStrategy],
})
export class AuthModule {}
