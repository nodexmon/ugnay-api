import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @MaxLength(300)
  @IsOptional()
  cancellationReason?: string;
}
