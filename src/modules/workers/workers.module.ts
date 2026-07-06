import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkersService } from '@/modules/workers/workers.service';
import { WorkersController } from '@/modules/workers/workers.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { FileStorageService } from '@/modules/workers/file-storage.service';
import { uploadConfig } from '@/config';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(uploadConfig)],
  controllers: [WorkersController],
  providers: [WorkersService, FileStorageService],
})
export class WorkersModule {}
