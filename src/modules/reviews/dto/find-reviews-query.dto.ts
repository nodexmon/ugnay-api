import { Type } from "class-transformer"
import { IsOptional, IsInt, Min, Max } from "class-validator"

export class FindReviewsQueryDto {
    
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