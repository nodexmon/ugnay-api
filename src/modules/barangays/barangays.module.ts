import { Module } from '@nestjs/common';
import { BarangaysService } from './barangays.service';
import { BarangaysController } from './barangays.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BarangaysController],
  providers: [BarangaysService],
})
export class BarangaysModule {}
