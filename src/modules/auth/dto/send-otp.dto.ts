import { IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @IsPhoneNumber('PH')
  phone: string;
}
