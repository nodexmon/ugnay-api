import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  NoShowReportType,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import type { Prisma, WorkerProfile } from '@/generated/prisma/client';

@Injectable()
export class AdminAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkerProfile(workerId: string): Promise<WorkerProfile> {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerId },
    });
    if (!worker) {
      throw new NotFoundException('Worker profile not found.');
    }
    return worker;
  }

  async assertWorkerIsUnverified(workerId: string): Promise<void> {
    const worker = await this.findWorkerProfile(workerId);
    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified.');
    }
  }

  async assertBookingExists(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }
  }

  async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
  }

  async assertPhoneNotRegistered(phone: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (user) {
      throw new ConflictException('Phone number is already registered.');
    }
  }

  async findPendingVerification(docId: string): Promise<
    Prisma.VerificationDocGetPayload<{
      include: { worker: { select: { userId: true } } };
    }>
  > {
    const doc = await this.prisma.verificationDoc.findUnique({
      where: { id: docId },
      include: { worker: { select: { userId: true } } },
    });
    if (!doc) {
      throw new NotFoundException('Verification submission not found.');
    }
    if (doc.status !== VerificationStatus.PENDING) {
      throw new ConflictException(
        'Verification submission has already been reviewed.',
      );
    }
    return doc;
  }

  async findPendingCredential(credentialId: string): Promise<
    Prisma.WorkerCredentialGetPayload<{
      include: { worker: { select: { userId: true } } };
    }>
  > {
    const credential = await this.prisma.workerCredential.findUnique({
      where: { id: credentialId },
      include: { worker: { select: { userId: true } } },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found.');
    }
    if (credential.status !== VerificationStatus.PENDING) {
      throw new ConflictException('Credential has already been reviewed.');
    }
    return credential;
  }

  async findPendingNoShowReport(reportId: string): Promise<
    Prisma.NoShowReportGetPayload<{
      include: {
        booking: {
          select: {
            id: true;
            workerId: true;
            worker: { select: { userId: true } };
          };
        };
      };
    }>
  > {
    const report = await this.prisma.noShowReport.findUnique({
      where: { id: reportId },
      include: {
        booking: {
          select: {
            id: true,
            workerId: true,
            worker: { select: { userId: true } },
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('No-show report not found.');
    }
    if (report.reportType !== NoShowReportType.WORKER) {
      throw new NotFoundException('No-show report not found.');
    }
    if (report.confirmed !== null) {
      throw new ConflictException('This report has already been resolved.');
    }
    return report;
  }

  async findSuspendedWorker(workerProfileId: string): Promise<WorkerProfile> {
    const worker = await this.prisma.workerProfile.findFirst({
      where: { id: workerProfileId, status: WorkerStatus.SUSPENDED },
    });
    if (!worker) {
      throw new NotFoundException('Suspended worker not found.');
    }
    return worker;
  }

  async findPendingCustomerNoShowReport(reportId: string): Promise<
    Prisma.NoShowReportGetPayload<{
      include: { booking: { select: { id: true; customerId: true } } };
    }>
  > {
    const report = await this.prisma.noShowReport.findUnique({
      where: { id: reportId },
      include: {
        booking: {
          select: {
            id: true,
            customerId: true,
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException('No-show report not found.');
    }
    if (report.reportType !== NoShowReportType.CUSTOMER) {
      throw new NotFoundException('No-show report not found.');
    }
    if (report.confirmed !== null) {
      throw new ConflictException('This report has already been resolved.');
    }
    return report;
  }
}
