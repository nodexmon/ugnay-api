import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkerStatus } from '@/generated/prisma/enums';

@Injectable()
export class AdminAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertWorkerIsUnverified(workerId: string): Promise<void> {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
    });
    if (!worker) throw new NotFoundException('Worker profile does not exist.');

    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified.');
    }
  }

  async assertBookingNotAlreadyStruck(bookingId: string): Promise<void> {
    const existingStrike = await this.prisma.strike.findUnique({
      where: { bookingId },
    });
    if (existingStrike) {
      throw new ConflictException(
        'This booking has already been used for a strike.',
      );
    }
  }
}
