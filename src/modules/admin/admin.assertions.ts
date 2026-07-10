import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkerStatus } from '@/generated/prisma/enums';
import { Booking, User, WorkerProfile } from '@/generated/prisma/client';

@Injectable()
export class AdminAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertWorkerProfileExists(workerId: string): Promise<WorkerProfile> {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
    });
    if (!worker) throw new NotFoundException('Worker profile does not exist.');
    return worker;
  }

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

  async assertBookingExists(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking does not exist.');
    return booking;
  }

  async assertUserExists(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User does not exist.');
    return user;
  }
}
