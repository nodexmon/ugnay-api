import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindReviewsAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter reviews by worker profile ID' })
  @IsOptional()
  @IsUUID()
  workerId?: string;
}
