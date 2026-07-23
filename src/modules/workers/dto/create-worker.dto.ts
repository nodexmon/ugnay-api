import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WorkerCategoryInputDto } from '@/modules/workers/dto/input-worker-category.dto';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsNumber()
  @Min(0)
  baseRate: number;

  @IsUUID()
  homeBarangayId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => WorkerCategoryInputDto)
  categories: WorkerCategoryInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUUID(undefined, { each: true })
  serviceAreaBarangayIds: string[];
}
