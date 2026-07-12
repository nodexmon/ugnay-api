import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BarangaysService } from './barangays.service';
import { BarangaysController } from './barangays.controller';
import { BarangaySyncService } from './barangay-sync.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { psgcConfig } from '@/config/psgc.config';

@Module({
  imports: [PrismaModule, HttpModule, ConfigModule.forFeature(psgcConfig)],
  controllers: [BarangaysController],
  providers: [BarangaysService, BarangaySyncService],
  exports: [BarangaySyncService],
})
export class BarangaysModule {}
