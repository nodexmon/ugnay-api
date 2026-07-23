import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { UploadsAssertions } from './uploads.assertions';
import { UploadsController } from './uploads.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { uploadConfig } from '@/config';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(uploadConfig)],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsAssertions],
})
export class UploadsModule {}
