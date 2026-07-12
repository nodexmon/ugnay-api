import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AdminController } from '@/modules/admin/admin.controller';
import { AdminService } from '@/modules/admin/admin.service';
import { AdminAssertions } from '@/modules/admin/admin.assertions';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { BarangaysModule } from '@/modules/barangays/barangays.module';

@Module({
  imports: [PrismaModule, NotificationsModule, BarangaysModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAssertions],
})
export class AdminModule {}
