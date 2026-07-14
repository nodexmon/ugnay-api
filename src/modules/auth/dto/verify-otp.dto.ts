import { IsNotEmpty, IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsPhoneNumber('PH')
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
