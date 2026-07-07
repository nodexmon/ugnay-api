import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @CheckAbility(Action.Create, 'Review')
  @Post()
  submitReview(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthJwtPayload) {
    return this.reviewsService.create(dto, user);
  }

  @CheckAbility(Action.Read, 'Review')
  @Get('my')
  findMyReviews(@CurrentUser() user: AuthJwtPayload, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findMyReviews(user.sub, query);
  }

  @Public()
  @Get('worker/:id')
  findReviewsByWorker(@Param('id') id: string, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findAllByWorkerId(id, query);
  }
}
