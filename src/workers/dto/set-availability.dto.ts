import { IsBoolean } from 'class-validator';

export class SetAvailabilityDto {
  @IsBoolean()
  isOnline: boolean;
}
