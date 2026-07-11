import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
