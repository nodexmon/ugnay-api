import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveNoShowDto {
  @IsBoolean()
  confirmed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
