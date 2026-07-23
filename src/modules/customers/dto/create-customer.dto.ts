import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @Matches(/^\/?uploads\/avatars\/[a-f0-9-]+\.(jpe?g|png|webp)$/i)
  @MaxLength(200)
  avatarUrl?: string | null;
}
