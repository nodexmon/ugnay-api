import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { WorkerStatus } from '@/generated/prisma/enums';

export class ListWorkersQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;
}
