import { StrikeReason } from '@/generated/prisma/enums';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class StrikeWorkerDto {
  @IsUUID()
  workerId: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsEnum(StrikeReason)
  reason: StrikeReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
