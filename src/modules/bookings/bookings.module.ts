import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { BookingsCron } from './bookings.cron';
import { BookingsAssertionsService } from './bookings.assertions';
import { BookingsNotificationService } from './bookings.notification';

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCron, BookingsAssertionsService, BookingsNotificationService],
})
export class BookingsModule {}
