import { BookingType, TimeWindow } from '@/generated/prisma/enums';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  Min,
  IsString,
  IsDate,
  IsUUID,
  Max,
  MaxLength,
  IsEnum,
  MinDate,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  workerId: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  barangayId: string;

  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsDate()
  @MinDate(new Date())
  @Type(() => Date)
  scheduledDate: Date;

  @IsEnum(TimeWindow)
  timeWindow: TimeWindow;

  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedRate: number;
}
