import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsQueryDto } from './dto/find-reviews-query.dto';

@Injectable()
export class ReviewsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateReviewDto) {

        const booking = await this.assertBookingExist(dto.bookingId)

        return await this.prisma.review.create({
            data: {
                workerId: booking.workerId,
                customerId: booking.customerId,
                ...dto
            }
        })
    }

    async findAllByWorkerId(id: string, query: FindReviewsQueryDto) {
        const worker = await this.asserWorkerExist(id)

        const reviews = await this.prisma.review.findMany({
            where: {
                workerId: worker.userId
            },
            orderBy: { createdAt: 'desc' },
            skip: query.skip,
            take: query.take
        })
    }

    private async assertBookingExist(bookingId: string) {

        const booking = await this.prisma.booking.findUnique({where: { id: bookingId}})
        
        if(!booking) {
            throw new NotFoundException("Booking not found.")
        }

        return booking
    }

    private async asserWorkerExist(workerId: string) {
        const worker = await this.prisma.workerProfile.findUnique({
            where: {
                userId: workerId
            }
        })

        if(!worker) {
            throw new NotFoundException("Worker not found.")
        }

        return worker
    }

}
