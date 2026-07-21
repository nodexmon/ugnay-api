import { IsPhoneNumber, Matches } from 'class-validator';

export class SendOtpDto {
  @Matches(/^\+63\d{10}$/, {
    message: 'Phone number must be in E.164 format (+63XXXXXXXXXX).',
  })
  @IsPhoneNumber('PH')
  phone: string;
}
