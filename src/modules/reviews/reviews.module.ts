import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReviewsAssertions } from './reviews.assertions';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsAssertions],
})
export class ReviewsModule {}
