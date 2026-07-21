import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BookingStatus,
  UserStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { CreateWorkerDto } from '@/modules/workers/dto/create-worker.dto';
import { UpdateWorkerDto } from '@/modules/workers/dto/update-worker.dto';
import { FindWorkersQueryDto } from '@/modules/workers/dto/find-workers-query.dto';
import type { UploadedVerificationFiles } from '@/modules/workers/workers.types';
import type { AvatarFile } from '@/uploads/uploads.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { FileStorageService } from '@/modules/workers/file-storage.service';
import { WorkersAssertions } from '@/modules/workers/workers.assertions';
import {
  PUBLIC_WORKER_INCLUDE,
  WORKER_INCLUDE,
} from '@/common/constants/worker-includes';
import { UsersAssertions } from '../users/users.assertions';
import { CredentialType } from '@/generated/prisma/enums';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly assertions: WorkersAssertions,
    private readonly usersAssertions: UsersAssertions,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async search(query: FindWorkersQueryDto) {
    const { availableOnly, categoryId, barangayId, skip, take } = query;

    const where = {
      status: WorkerStatus.VERIFIED,
      isOnline: availableOnly === true ? true : undefined,
      user: { status: UserStatus.ACTIVE },
      categories: categoryId
        ? { some: { categoryId, category: { isActive: true } } }
        : undefined,
      serviceAreas: barangayId ? { some: { barangayId } } : undefined,
      bookings: {
        none: {
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.ACCEPTED,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workerProfile.findMany({
        where,
        include: PUBLIC_WORKER_INCLUDE,
        orderBy: [
          { averageRating: 'desc' },
          { totalReviews: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.workerProfile.count({ where }),
    ]);
    return {
      items: items.map((w) => ({
        ...w,
        averageRating: w.totalReviews >= 3 ? w.averageRating : null,
      })),
      total,
      skip,
      take,
    };
  }

  async findOwnProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: WORKER_INCLUDE,
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');
    return worker;
  }

  async findOwnVerification(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');

    return this.prisma.verificationDoc.findFirst({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOwnStrikes(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');

    const strikes = await this.prisma.strike.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: 'desc' },
    });
    return { items: strikes, total: worker.strikeCount };
  }

  async findPublicProfile(id: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: {
        id,
        status: WorkerStatus.VERIFIED,
        user: { status: UserStatus.ACTIVE },
      },
      include: PUBLIC_WORKER_INCLUDE,
    });

    if (!worker) throw new NotFoundException('Worker profile not found.');

    return {
      ...worker,
      averageRating: worker.totalReviews >= 3 ? worker.averageRating : null,
    };
  }

  async createProfile(userId: string, dto: CreateWorkerDto) {
    await this.usersAssertions.findActiveUser(userId);
    await this.assertions.assertProfileDoesNotExist(userId);
    await this.assertions.assertCategoriesAreValid(
      dto.categories.map((c) => c.categoryId),
    );

    const barangayIds = [
      ...new Set([dto.homeBarangayId, ...(dto.serviceAreaBarangayIds ?? [])]),
    ];
    await this.assertions.assertBarangaysAreValid(barangayIds);

    return this.prisma.workerProfile.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        baseRate: dto.baseRate,
        homeBarangayId: dto.homeBarangayId,
        status: WorkerStatus.PENDING,
        categories: {
          create: dto.categories.map((category) => ({
            categoryId: category.categoryId,
            rateOverride: category.rateOverride,
          })),
        },
        serviceAreas: {
          create: dto.serviceAreaBarangayIds.map((barangayId) => ({
            barangayId,
          })),
        },
      },
      include: WORKER_INCLUDE,
    });
  }

  async updateProfile(userId: string, dto: UpdateWorkerDto) {
    const worker = await this.getOwnProfile(userId);

    if (dto.homeBarangayId || dto.serviceAreaBarangayIds) {
      const barangayIds = [
        ...new Set([
          dto.homeBarangayId ?? worker.homeBarangayId,
          ...(dto.serviceAreaBarangayIds ?? []),
        ]),
      ];
      await this.assertions.assertBarangaysAreValid(barangayIds);
    }

    if (dto.categories) {
      await this.assertions.assertCategoriesAreValid(
        dto.categories.map((c) => c.categoryId),
      );
    }

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      if (dto.categories) {
        await tx.workerCategory.deleteMany({ where: { workerId: worker.id } });
        await tx.workerCategory.createMany({
          data: dto.categories.map((category) => ({
            workerId: worker.id,
            categoryId: category.categoryId,
            rateOverride: category.rateOverride,
          })),
        });
      }

      if (dto.serviceAreaBarangayIds) {
        await tx.workerServiceArea.deleteMany({
          where: { workerId: worker.id },
        });
        await tx.workerServiceArea.createMany({
          data: dto.serviceAreaBarangayIds.map((barangayId) => ({
            workerId: worker.id,
            barangayId,
          })),
        });
      }

      return tx.workerProfile.update({
        where: { id: worker.id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          bio: dto.bio,
          avatarUrl: dto.avatarUrl,
          baseRate: dto.baseRate,
          homeBarangayId: dto.homeBarangayId,
        },
        include: WORKER_INCLUDE,
      });
    });
  }

  async setAvailability(userId: string, isOnline: boolean) {
    const worker = await this.getOwnProfile(userId);

    if (isOnline) {
      this.assertions.assertWorkerCanGoOnline(worker);
    }

    return this.prisma.workerProfile.update({
      where: { id: worker.id },
      data: { isOnline },
      include: WORKER_INCLUDE,
    });
  }

  async submitVerification(userId: string, files: UploadedVerificationFiles) {
    const worker = await this.getOwnProfile(userId);
    this.assertions.assertWorkerCanSubmitVerification(worker);

    const idPhoto = files.idPhoto[0];
    const selfie = files.selfie[0];

    const idPhotoPath = this.fileStorage.resolvePath(
      worker.id,
      'id-photo',
      idPhoto,
    );
    const selfiePath = this.fileStorage.resolvePath(
      worker.id,
      'selfie',
      selfie,
    );

    await Promise.all([
      this.fileStorage.write(idPhotoPath, idPhoto),
      this.fileStorage.write(selfiePath, selfie),
    ]);

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await this.assertions.assertNoPendingVerification(worker.id, tx);
      await this.assertions.assertVerificationReapplicationAllowed(
        worker.id,
        tx,
      );

      await tx.workerProfile.update({
        where: { id: worker.id },
        data: { status: WorkerStatus.PENDING },
      });

      return tx.verificationDoc.create({
        data: {
          workerId: worker.id,
          idPhotoUrl: idPhotoPath.relative,
          selfieUrl: selfiePath.relative,
        },
      });
    });
  }

  async uploadCredential(
    userId: string,
    type: CredentialType,
    file: AvatarFile,
  ) {
    const worker = await this.getOwnProfile(userId);

    const credentialPath = this.fileStorage.resolvePath(
      worker.id,
      type.toLowerCase(),
      file,
      'credentials',
    );

    await this.fileStorage.write(credentialPath, file);

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await this.assertions.assertActiveCredentialCountUnder(worker.id, tx);

      return tx.workerCredential.create({
        data: { workerId: worker.id, type, fileUrl: credentialPath.relative },
      });
    });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private async getOwnProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');
    return worker;
  }
}
