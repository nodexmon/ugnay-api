import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { Platform } from '@/generated/prisma/enums';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(Platform)
  platform: Platform;
}
