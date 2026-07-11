import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkersService } from '@/modules/workers/workers.service';
import { WorkersController } from '@/modules/workers/workers.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { FileStorageService } from '@/modules/workers/file-storage.service';
import { WorkersAssertions } from '@/modules/workers/workers.assertions';
import { uploadConfig } from '@/config';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(uploadConfig), UsersModule],
  controllers: [WorkersController],
  providers: [WorkersService, FileStorageService, WorkersAssertions],
})
export class WorkersModule {}
