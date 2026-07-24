import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import {
  MAX_ACTIVE_CREDENTIALS,
  MAX_VERIFICATION_REJECTIONS,
} from '@/modules/workers/workers.constants';

@Injectable()
export class WorkersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertProfileDoesNotExist(userId: string): Promise<void> {
    const existing = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Worker profile already exists.');
    }
  }

  assertUnique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`Duplicate ${label} are not allowed.`);
    }
  }

  assertWorkerCanGoOnline(worker: { status: WorkerStatus }): void {
    if (worker.status !== WorkerStatus.VERIFIED) {
      throw new ForbiddenException(
        'Worker must be verified before going online.',
      );
    }
  }

  assertWorkerCanSubmitVerification(worker: { status: WorkerStatus }): void {
    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified.');
    }
    if (worker.status === WorkerStatus.SUSPENDED) {
      throw new ForbiddenException('Worker account is suspended.');
    }
  }

  async assertNoPendingVerification(
    workerId: string,
    tx: TransactionClient,
  ): Promise<void> {
    const pendingDoc = await tx.verificationDoc.findFirst({
      where: { workerId, status: VerificationStatus.PENDING },
    });
    if (pendingDoc) {
      throw new ConflictException(
        'A verification submission is already pending.',
      );
    }
  }

  async assertVerificationReapplicationAllowed(
    workerId: string,
    tx: TransactionClient,
  ): Promise<void> {
    const rejectedCount = await tx.verificationDoc.count({
      where: { workerId, status: VerificationStatus.REJECTED },
    });
    if (rejectedCount >= MAX_VERIFICATION_REJECTIONS) {
      throw new ForbiddenException(
        'Verification reapplication limit has been reached.',
      );
    }
  }

  async assertActiveCredentialCountUnder(
    workerId: string,
    tx: TransactionClient,
  ): Promise<void> {
    const activeCount = await tx.workerCredential.count({
      where: {
        workerId,
        status: {
          in: [VerificationStatus.PENDING, VerificationStatus.APPROVED],
        },
      },
    });
    if (activeCount >= MAX_ACTIVE_CREDENTIALS) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACTIVE_CREDENTIALS} active credentials allowed.`,
      );
    }
  }

  async assertBarangaysAreValid(barangayIds: string[]): Promise<void> {
    this.assertUnique(barangayIds, 'barangays');
    const count = await this.prisma.barangay.count({
      where: { id: { in: barangayIds }, isActive: true },
    });
    if (count !== barangayIds.length) {
      throw new BadRequestException(
        'One or more barangays are invalid or inactive.',
      );
    }
  }

  async assertCategoriesAreValid(categoryIds: string[]): Promise<void> {
    this.assertUnique(categoryIds, 'categories');
    const count = await this.prisma.serviceCategory.count({
      where: { id: { in: categoryIds }, isActive: true },
    });
    if (count !== categoryIds.length) {
      throw new BadRequestException(
        'One or more categories are invalid or inactive.',
      );
    }
  }
}
