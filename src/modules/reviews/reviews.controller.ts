import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { query } from 'axios';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  submitReview(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto)
  }

  @Get('worker/:id')
  findReviewsByWorker(@Param('id') id: string, @Query() query: FindReviewsQueryDto)  {
    return this.reviewsService.findAllByWorkerId(id, query)
  }
}
