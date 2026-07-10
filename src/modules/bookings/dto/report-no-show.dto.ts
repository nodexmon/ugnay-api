import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportNoShowDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
