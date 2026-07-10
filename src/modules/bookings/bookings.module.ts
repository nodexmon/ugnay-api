import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { BookingsCron } from './bookings.cron';
import { BookingsAssertions } from './bookings.assertions';

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCron, BookingsAssertions],
})
export class BookingsModule {}
