import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  listPendingVerifications() {
    return this.prisma.verificationDoc.findMany({
      where: { status: VerificationStatus.PENDING },
      include: {
        worker: {
          include: {
            user: true,
            homeBarangay: true,
            categories: { include: { category: true } },
            serviceAreas: { include: { barangay: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveVerification(id: string, adminUserId: string) {
    const doc = await this.getPendingVerification(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.verificationDoc.update({
        where: { id },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      });

      return tx.workerProfile.update({
        where: { id: doc.workerId },
        data: {
          status: WorkerStatus.VERIFIED,
        },
        include: {
          verificationDocs: { orderBy: { createdAt: 'desc' } },
          homeBarangay: true,
          categories: { include: { category: true } },
          serviceAreas: { include: { barangay: true } },
        },
      });
    });
  }

  async rejectVerification(id: string, adminUserId: string, reason: string) {
    const doc = await this.getPendingVerification(id);
    const previousRejections = await this.prisma.verificationDoc.count({
      where: {
        workerId: doc.workerId,
        status: VerificationStatus.REJECTED,
      },
    });
    const secondRejection = previousRejections + 1 >= 2;

    return this.prisma.$transaction(async (tx) => {
      await tx.verificationDoc.update({
        where: { id },
        data: {
          status: VerificationStatus.REJECTED,
          rejectionReason: reason,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      });

      return tx.workerProfile.update({
        where: { id: doc.workerId },
        data: {
          status: secondRejection ? WorkerStatus.SUSPENDED : WorkerStatus.REJECTED,
          isOnline: false,
        },
        include: {
          verificationDocs: { orderBy: { createdAt: 'desc' } },
          homeBarangay: true,
          categories: { include: { category: true } },
          serviceAreas: { include: { barangay: true } },
        },
      });
    });
  }

  async setUserSuspension(userId: string, suspended: boolean) {
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
    });

    if (updated.count === 0) throw new NotFoundException('User not found');

    if (suspended) {
      await this.prisma.workerProfile.updateMany({
        where: { userId },
        data: { status: WorkerStatus.SUSPENDED, isOnline: false },
      });
    }

    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private async getPendingVerification(id: string) {
    const doc = await this.prisma.verificationDoc.findUnique({ where: { id } });

    if (!doc) throw new NotFoundException('Verification submission not found');
    if (doc.status !== VerificationStatus.PENDING) {
      throw new ConflictException('Verification submission has already been reviewed');
    }

    return doc;
  }
}
