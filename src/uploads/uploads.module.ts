import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { UploadsAssertions } from './uploads.assertions';
import { UploadsController } from './uploads.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { FileCryptoService } from '@/common/services/file-crypto.service';
import { uploadConfig } from '@/config';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(uploadConfig)],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsAssertions, FileCryptoService],
})
export class UploadsModule {}
