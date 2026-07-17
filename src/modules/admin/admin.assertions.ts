import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkerStatus } from '@/generated/prisma/enums';
import type { Booking, User, WorkerProfile } from '@/generated/prisma/client';
import {
  assertBookingExists,
  assertUserExists,
} from '@/common/utils/assert.util';

@Injectable()
export class AdminAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertWorkerProfileExists(workerId: string): Promise<WorkerProfile> {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');
    return worker;
  }

  async assertWorkerIsUnverified(workerId: string): Promise<void> {
    const worker = await this.assertWorkerProfileExists(workerId);
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

  assertBookingExists(bookingId: string): Promise<Booking> {
    return assertBookingExists(this.prisma, bookingId);
  }

  assertUserExists(userId: string): Promise<User> {
    return assertUserExists(this.prisma, userId);
  }
}
