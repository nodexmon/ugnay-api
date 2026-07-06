import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { CreateWorkerDto } from '@/modules/workers/dto/create-worker.dto';
import { WorkerCategoryInputDto } from '@/modules/workers/dto/input-worker-category.dto';
import { UpdateWorkerDto } from '@/modules/workers/dto/update-worker.dto';
import { SearchWorkersDto } from '@/modules/workers/dto/search-workers.dto';
import type { UploadedVerificationFiles } from '@/modules/workers/workers.types';
import { Prisma } from '@/generated/prisma/client';
import { FileStorageService } from '@/modules/workers/file-storage.service';

const PUBLIC_WORKER_INCLUDE = {
  homeBarangay: true,
  categories: { include: { category: true } },
  serviceAreas: { include: { barangay: true } },
};

const WORKER_INCLUDE = {
  ...PUBLIC_WORKER_INCLUDE,
  verificationDocs: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class WorkersService {
  constructor(
    private prisma: PrismaService,
    private fileStorage: FileStorageService,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  async search(query: SearchWorkersDto) {
    const { availableOnly, categoryId, barangayId, page = 1, limit = 20 } = query;

    return this.prisma.workerProfile.findMany({
      where: {
        status: WorkerStatus.VERIFIED,
        isOnline: availableOnly === true ? true : undefined,
        user: { status: UserStatus.ACTIVE },
        categories: categoryId
          ? { some: { categoryId, category: { isActive: true } } }
          : undefined,
        serviceAreas: barangayId ? { some: { barangayId } } : undefined,
        bookings: {
          none: {
            status: { in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS] },
          },
        },
      },
      include: PUBLIC_WORKER_INCLUDE,
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOwnProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: WORKER_INCLUDE,
    });
    if (!worker) throw new NotFoundException('Worker profile not found.');
    return worker;
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

    if (!worker) throw new NotFoundException('Worker profile is not found.');

    return {
      ...worker,
      averageRating: worker.totalReviews >= 3 ? worker.averageRating : null,
    };
  }

  async createProfile(userId: string, dto: CreateWorkerDto) {
    await this.assertUserIsActive(userId);
    await this.assertProfileDoesNotExist(userId);
    await this.validateCategories(dto.categories);

    const barangayIds = [...new Set([dto.homeBarangayId, ...(dto.serviceAreaBarangayIds ?? [])])];
    await this.validateBarangays(barangayIds);

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
          create: dto.serviceAreaBarangayIds.map((barangayId) => ({ barangayId })),
        },
      },
      include: WORKER_INCLUDE,
    });
  }

  async updateProfile(userId: string, dto: UpdateWorkerDto) {
    const worker = await this.getOwnProfile(userId);

    if (dto.homeBarangayId || dto.serviceAreaBarangayIds) {
      const barangayIds = [
        ...new Set([dto.homeBarangayId ?? worker.homeBarangayId, ...(dto.serviceAreaBarangayIds ?? [])]),
      ];
      await this.validateBarangays(barangayIds);
    }

    if (dto.categories) {
      await this.validateCategories(dto.categories);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
        await tx.workerServiceArea.deleteMany({ where: { workerId: worker.id } });
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

    if (isOnline && worker.status !== WorkerStatus.VERIFIED) {
      throw new ForbiddenException('Worker must be verified before going online');
    }

    return this.prisma.workerProfile.update({
      where: { id: worker.id },
      data: { isOnline },
      include: WORKER_INCLUDE,
    });
  }

  async submitVerification(userId: string, files: UploadedVerificationFiles) {
    const worker = await this.getOwnProfile(userId);

    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified');
    }

    if (worker.status === WorkerStatus.SUSPENDED) {
      throw new ForbiddenException('Worker account is suspended');
    }

    const idPhoto = files.idPhoto[0];
    const selfie = files.selfie[0];

    const idPhotoPath = this.fileStorage.resolvePath(worker.id, 'id-photo', idPhoto);
    const selfiePath = this.fileStorage.resolvePath(worker.id, 'selfie', selfie);

    const doc = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pendingDoc = await tx.verificationDoc.findFirst({
        where: { workerId: worker.id, status: VerificationStatus.PENDING },
      });

      if (pendingDoc) throw new ConflictException('A verification submission is already pending');

      const rejectedCount = await tx.verificationDoc.count({
        where: { workerId: worker.id, status: VerificationStatus.REJECTED },
      });

      if (rejectedCount >= 2) {
        throw new ForbiddenException('Verification reapplication limit has been reached.');
      }

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

    await Promise.all([
      this.fileStorage.write(idPhotoPath, idPhoto),
      this.fileStorage.write(selfiePath, selfie),
    ]);

    return doc;
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  private async assertUserIsActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Active user is required.');
    }
  }

  private async assertProfileDoesNotExist(userId: string): Promise<void> {
    const existing = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Worker profile already exists');
    }
  }

  private async getOwnProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (!worker) {
      throw new NotFoundException('Worker profile not found');
    }
    return worker;
  }

  // ─── Validators ───────────────────────────────────────────────────────────

  private async validateActiveEntities(
    ids: string[],
    countFn: (ids: string[]) => Promise<number>,
    label: string,
  ): Promise<void> {
    this.assertUnique(ids, label);
    const count = await countFn(ids);
    if (count !== ids.length) {
      throw new BadRequestException(`One or more ${label} are invalid or inactive`);
    }
  }

  private async validateBarangays(barangayIds: string[]): Promise<void> {
    await this.validateActiveEntities(
      barangayIds,
      (ids) => this.prisma.barangay.count({ where: { id: { in: ids }, isActive: true } }),
      'barangays',
    );
  }

  private async validateCategories(categories: WorkerCategoryInputDto[]): Promise<void> {
    await this.validateActiveEntities(
      categories.map((c) => c.categoryId),
      (ids) => this.prisma.serviceCategory.count({ where: { id: { in: ids }, isActive: true } }),
      'categories',
    );
  }

  private assertUnique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`Duplicate ${label} are not allowed`);
    }
  }
}
