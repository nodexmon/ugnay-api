import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { BookingsCron } from './bookings.cron';
import { BookingsAssertions } from './bookings.assertions';
import { UsersModule } from '@/modules/users/users.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [PrismaModule, UsersModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCron, BookingsAssertions],
})
export class BookingsModule {}
