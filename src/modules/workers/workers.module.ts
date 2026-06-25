import { Module } from '@nestjs/common';
import { WorkersService } from '@/modules/workers/workers.service';
import { WorkersController } from '@/modules/workers/workers.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
