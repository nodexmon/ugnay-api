import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import type { Booking, User, WorkerProfile } from '@/generated/prisma/client';

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

  async assertBookingExists(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  async assertUserExists(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User does not exist.');
    return user;
  }

  async findPendingVerification(docId: string) {
    const doc = await this.prisma.verificationDoc.findUnique({
      where: { id: docId },
      include: { worker: { select: { userId: true } } },
    });
    if (!doc) throw new NotFoundException('Verification submission not found.');
    if (doc.status !== VerificationStatus.PENDING) {
      throw new ConflictException(
        'Verification submission has already been reviewed.',
      );
    }
    return doc;
  }

  async findPendingCredential(credentialId: string) {
    const credential = await this.prisma.workerCredential.findUnique({
      where: { id: credentialId },
      include: { worker: { select: { userId: true } } },
    });
    if (!credential) throw new NotFoundException('Credential not found.');
    if (credential.status !== VerificationStatus.PENDING) {
      throw new ConflictException('Credential has already been reviewed.');
    }
    return credential;
  }
}
