import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class FindBookingsQueryDto {
    @IsOptional()
    @IsIn(['active', 'history'])
    status?: 'active' | 'history'

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    take?: number = 10
}