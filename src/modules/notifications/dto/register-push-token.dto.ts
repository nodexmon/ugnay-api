import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Platform } from '@/generated/prisma/enums';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;

  @IsEnum(Platform)
  platform: Platform;
}
