import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus, Role, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { CreateWorkerDto } from '@/modules/workers/dto/create-worker.dto';
import { WorkerCategoryInputDto } from '@/modules/workers/dto/input-worker-category.dto';
import { UpdateWorkerDto } from '@/modules/workers/dto/update-worker.dto';
import { SearchWorkersDto } from '@/modules/workers/dto/search-workers.dto';
import type { FileMetadata, UploadedVerificationFiles } from '@/modules/workers/workers.types';
import { Prisma } from '@/generated/prisma/client';

const WORKER_INCLUDE = {
  homeBarangay: true,
  categories: { include: { category: true } },
  serviceAreas: { include: { barangay: true } },
  verificationDocs: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class WorkersService {
  constructor(private prisma: PrismaService) {}

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
      include: {
        homeBarangay: true,
        categories: { include: { category: true } },
        serviceAreas: { include: { barangay: true } },
      },
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findPublicProfile(id: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: {
        id,
        status: WorkerStatus.VERIFIED,
        user: { status: UserStatus.ACTIVE },
      },
      include: {
        homeBarangay: true,
        categories: { include: { category: true } },
        serviceAreas: { include: { barangay: true } },
      },
    });

    if (!worker) throw new NotFoundException('Worker profile is not found.');

    return worker;
  }

  async createProfile(userId: string, role: Role, dto: CreateWorkerDto) {
    this.assertWorkerRole(role);
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

  async updateProfile(userId: string, role: Role, dto: UpdateWorkerDto) {
    this.assertWorkerRole(role);
    const worker = await this.getOwnProfile(userId);

    if (dto.homeBarangayId || dto.serviceAreaBarangayIds) {
      const barangayIds = [
        ...new Set([dto.homeBarangayId ?? worker.homeBarangayId, ...(dto.serviceAreaBarangayIds ?? [])]),
      ];
      await this.validateBarangays(barangayIds);
    }

    if (dto.categories) {
      this.assertUnique(dto.categories.map((c) => c.categoryId), 'categories');
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

  async setAvailability(userId: string, role: Role, isOnline: boolean) {
    this.assertWorkerRole(role);
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

  async submitVerification(userId: string, role: Role, files: UploadedVerificationFiles) {
    this.assertWorkerRole(role);
    const worker = await this.getOwnProfile(userId);

    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified');
    }

    if (worker.status === WorkerStatus.SUSPENDED) {
      throw new ForbiddenException('Worker account is suspended');
    }

    const idPhoto = files.idPhoto[0]
    const selfie = files.selfie[0]

    const idPhotoPath = this.resolveVerificationPath(worker.id, 'id-photo', idPhoto);
    const selfiePath = this.resolveVerificationPath(worker.id, 'selfie', selfie);

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

    try {
      await Promise.all([
        this.writeVerificationFile(idPhotoPath, idPhoto),
        this.writeVerificationFile(selfiePath, selfie),
      ]);
    } catch (err) {
      console.error(`File write failed after verification doc ${doc.id} was created`);
      throw err;
    }

    return doc;
  }

  // ─── Guards / Assertions ──────────────────────────────────────────────────

  private assertWorkerRole(role: string) {
    if (role !== Role.WORKER) {
      throw new ForbiddenException('Worker role is required.');
    }
  }

  private async assertUserIsActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Active user is required.');
    }

    return user
  }

  private async assertProfileDoesNotExist(userId: string) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Worker profile already exists');
    }
    return existing
  }

  private async getOwnProfile(userId: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (!worker) {
      throw new NotFoundException('Worker profile not found');
    }
    return worker;
  }

  // ─── Validators ───────────────────────────────────────────────────────────

  private async validateBarangays(barangayIds: string[]) {
    this.assertUnique(barangayIds, 'barangays');

    const count = await this.prisma.barangay.count({
      where: { id: { in: barangayIds }, isActive: true },
    });

    if (count !== barangayIds.length) {
      throw new BadRequestException('One or more barangays are invalid or inactive');
    }
  }

  private async validateCategories(categories: WorkerCategoryInputDto[]) {
    const categoryIds = categories.map((c) => c.categoryId);
    this.assertUnique(categoryIds, 'categories');

    const count = await this.prisma.serviceCategory.count({
      where: { id: { in: categoryIds }, isActive: true },
    });

    if (count !== categoryIds.length) {
      throw new BadRequestException('One or more categories are invalid or inactive');
    }
  }

  private assertUnique(values: string[], label: string) {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`Duplicate ${values} are not allowed`);
    }
  }

  // ─── File Handling ────────────────────────────────────────────────────────

  private resolveVerificationPath(workerId: string, kind: string, file: FileMetadata) {
    const uploadRoot = process.env.UPLOAD_DIR ?? 'uploads';
    const relativeDir = join('verification', workerId);
    const extension = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${kind}-${randomUUID()}${extension}`;
    const relative = join(uploadRoot, relativeDir, filename).replace(/\\/g, '/');
    const absolute = join(__dirname, '..', '..', uploadRoot, relativeDir, filename);
    return { relative, absolute, dir: join(__dirname, '..', '..', uploadRoot, relativeDir) };
  }

  private async writeVerificationFile(
    paths: ReturnType<typeof this.resolveVerificationPath>,
    file: FileMetadata,
  ) {
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.absolute, file.buffer);
  }
}