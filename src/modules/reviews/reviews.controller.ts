import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/generated/prisma/enums';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  submitReview(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthJwtPayload) {
    return this.reviewsService.create(dto, user)
  }

  @Roles(Role.CUSTOMER)
  @Get('my')
  findMyReviews(@CurrentUser() user: AuthJwtPayload, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findMyReviews(user.sub, query)
  }

  @Get('worker/:id')
  findReviewsByWorker(@Param('id') id: string, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findAllByWorkerId(id, query)
  }
}
