import { Module } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { jwtConfig } from '@/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [jwtConfig.KEY],
      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.JWT_SECRET,
        signOptions: {
          expiresIn: config.JWT_ACCESS_EXPIRES_IN
        }
      })
    }),
    PrismaModule,
    HttpModule,
    ConfigModule.forFeature(jwtConfig)
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, AuthJwtService, SmsService, JwtStrategy],
})
export class AuthModule {}
