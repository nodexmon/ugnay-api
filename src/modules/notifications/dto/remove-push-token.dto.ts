import { IsString, IsNotEmpty } from 'class-validator';

export class RemovePushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
