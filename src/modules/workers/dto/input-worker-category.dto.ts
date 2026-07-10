import { IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class WorkerCategoryInputDto {
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateOverride?: number;
}
