import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindBookingsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['active', 'history'])
  status?: 'active' | 'history';
}
