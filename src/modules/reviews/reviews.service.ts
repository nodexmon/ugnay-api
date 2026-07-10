import { PrismaService } from '@/prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@/generated/prisma/enums';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';
import { AuthJwtPayload } from '@/modules/auth/auth.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import {
  assertBookingExists,
  assertWorkerProfileExists,
} from '@/common/utils/assert.util';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  async create(dto: CreateReviewDto, user: AuthJwtPayload) {
    const booking = await assertBookingExists(this.prisma, dto.bookingId);

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException(
        'Reviews can only be submitted for completed bookings.',
      );
    }

    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });
    if (!customerProfile || booking.customerId !== customerProfile.id) {
      throw new ForbiddenException(
        'Only the customer of this booking may submit a review.',
      );
    }

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
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customerProfile)
      throw new NotFoundException('Customer profile not found.');

    return this.prisma.review.findMany({
      where: { customerId: customerProfile.id },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    });
  }

  async findAllByWorkerId(workerId: string, query: FindReviewsQueryDto) {
    const worker = await assertWorkerProfileExists(this.prisma, workerId);

    return this.prisma.review.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    });
  }
}
