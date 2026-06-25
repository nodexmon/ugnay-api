import { IsEnum, IsNotEmpty, IsPhoneNumber, IsString, Length } from 'class-validator';
import { Role } from '@/generated/prisma/enums';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsPhoneNumber('PH')
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;

  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;
}
