import {
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @Matches(/^\+63\d{10}$/, {
    message: 'Phone number must be in E.164 format (+63XXXXXXXXXX).',
  })
  @IsPhoneNumber('PH')
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
