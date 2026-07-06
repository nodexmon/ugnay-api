import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  submitReview(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthJwtPayload) {
    return this.reviewsService.create(dto, user)
  }

  @Get('worker/:id')
  findReviewsByWorker(@Param('id') id: string, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findAllByWorkerId(id, query)
  }
}
