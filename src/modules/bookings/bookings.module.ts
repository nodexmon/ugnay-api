import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { BookingsCron } from './bookings.cron';
import { BookingsAssertions } from './bookings.assertions';
import { BookingsNotificationService } from './bookings.notification';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCron, BookingsAssertions, BookingsNotificationService],
})
export class BookingsModule {}
