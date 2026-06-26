import { BookingStatus } from "@/generated/prisma/enums";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Logger } from "nestjs-pino";


@Injectable()
export class BookingsCron {
    constructor(private readonly logger: Logger, private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async expiredPendingBookings() {
        const expiredBookings = await this.prisma.booking.findMany({
            where: {
                status: BookingStatus.PENDING,
                expiresAt: { lt: new Date() }
            },
            select: {
                id: true,
                customerId: true
            }
        })

        if(expiredBookings.length === 0) return

        this.logger.log(`Expiring ${expiredBookings.length} pending bookings`)

        for (const booking of expiredBookings) {
            await this.prisma.booking.update({
                where: { id: booking.id },
                data: { status: BookingStatus.EXPIRED}
            })
        }
    }

}