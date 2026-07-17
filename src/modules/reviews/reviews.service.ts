import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';
import { AuthJwtPayload } from '@/modules/auth/auth.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { ReviewsAssertions } from './reviews.assertions';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ReviewsAssertions,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async create(dto: CreateReviewDto, user: AuthJwtPayload) {
    const booking = await this.assertions.assertBookingExistsAndCompleted(
      dto.bookingId,
    );

    const customerProfile = await this.assertions.assertCustomerProfileExists(
      user.sub,
    );

    this.assertions.assertCustomerOwnsBooking(
      booking.customerId,
      customerProfile.id,
    );

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      const review = await tx.review.create({
        data: {
          workerId: booking.workerId,
          customerId: booking.customerId,
          ...dto,
        },
      });

      const { _avg, _count } = await tx.review.aggregate({
        where: { workerId: booking.workerId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.workerProfile.update({
        where: { id: booking.workerId },
        data: {
          averageRating: _avg.rating ?? 0,
          totalReviews: _count,
        },
      });

      return review;
    });
  }

  async findMyReviews(userId: string, query: FindReviewsQueryDto) {
    const customerProfile = await this.assertions.assertCustomerProfileExists(
      userId,
    );

    return this.prisma.review.findMany({
      where: { customerId: customerProfile.id },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    });
  }

  async findAllByWorkerId(workerId: string, query: FindReviewsQueryDto) {
    await this.assertions.assertWorkerProfileExists(workerId);

    return this.prisma.review.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    });
  }
}
