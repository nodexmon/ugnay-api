import { Injectable, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BookingStatus,
  NoShowReportType,
  Role,
  StrikeReason,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { CreateAdminDto } from './dto/create-admin.dto';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { FindWorkersQueryDto } from './dto/find-workers-query.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AuthJwtPayload } from '../auth/auth.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import {
  ADMIN_WORKER_INCLUDE,
  WORKER_INCLUDE,
} from '@/common/constants/worker-includes';
import { FindReviewsAdminQueryDto } from './dto/find-reviews-admin-query.dto';
import { ReinstateWorkerDto } from './dto/reinstate-worker.dto';
import { AdminAssertions } from './admin.assertions';
import { BarangaySyncService } from '@/modules/barangays/barangay-sync.service';
import { applyStrike } from '@/common/utils/strike.util';
import { computeWorkerRatingUpdate } from '@/common/utils/rating.util';
import type {
  User,
  WorkerCredential,
  WorkerProfile,
} from '@/generated/prisma/client';
import type { Paginated } from '@/common/types/paginated';
import type {
  AdminBookingListItem,
  AdminReviewListItem,
  AdminUserListItem,
  AdminWorkerListItem,
  NoShowResolution,
  PendingCredential,
  PendingCustomerNoShow,
  PendingNoShow,
  PendingVerification,
  WorkerWithRelations,
} from './admin.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly assertions: AdminAssertions,
    private readonly barangaySync: BarangaySyncService,
    private readonly logger: Logger,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  syncBarangays(): ReturnType<BarangaySyncService['syncBarangays']> {
    return this.barangaySync.syncBarangays();
  }

  async findPendingVerifications(
    query: PaginationDto,
  ): Promise<Paginated<PendingVerification>> {
    const where = { status: VerificationStatus.PENDING };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.verificationDoc.findMany({
        where,
        include: { worker: { include: ADMIN_WORKER_INCLUDE } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.verificationDoc.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async approveVerification(
    docId: string,
    user: AuthJwtPayload,
  ): Promise<WorkerWithRelations> {
    const doc = await this.assertions.findPendingVerification(docId);
    await this.assertions.assertWorkerIsUnverified(doc.workerId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        await tx.verificationDoc.update({
          where: { id: docId },
          data: {
            status: VerificationStatus.APPROVED,
            reviewedBy: user.sub,
            reviewedAt: new Date(),
          },
        });

        return tx.workerProfile.update({
          where: { id: doc.workerId },
          data: { status: WorkerStatus.VERIFIED },
          include: WORKER_INCLUDE,
        });
      })
      .then((result) => {
        void this.notifications
          .sendToUser(doc.worker.userId, {
            title: 'Verification approved',
            body: 'Your profile has been verified. You can now receive booking requests.',
          })
          .catch(() => {});
        return result;
      });
  }

  async rejectVerification(
    docId: string,
    user: AuthJwtPayload,
    reason: string,
  ): Promise<WorkerWithRelations> {
    const doc = await this.assertions.findPendingVerification(docId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        const previousRejections = await tx.verificationDoc.count({
          where: {
            workerId: doc.workerId,
            status: VerificationStatus.REJECTED,
          },
        });
        const isSecondRejection = previousRejections + 1 >= 2;

        await tx.verificationDoc.update({
          where: { id: docId },
          data: {
            status: VerificationStatus.REJECTED,
            rejectionReason: reason,
            reviewedBy: user.sub,
            reviewedAt: new Date(),
          },
        });

        return tx.workerProfile.update({
          where: { id: doc.workerId },
          data: {
            status: isSecondRejection
              ? WorkerStatus.SUSPENDED
              : WorkerStatus.REJECTED,
            isOnline: false,
          },
          include: WORKER_INCLUDE,
        });
      })
      .then((result) => {
        void this.notifications
          .sendToUser(doc.worker.userId, {
            title: 'Verification rejected',
            body: reason,
          })
          .catch(() => {});
        return result;
      });
  }

  async createAdmin(dto: CreateAdminDto): Promise<User> {
    await this.assertions.assertPhoneNotRegistered(dto.phone);

    return this.prisma.user.create({
      data: { phone: dto.phone, role: Role.ADMIN },
    });
  }

  async setUserSuspension(workerId: string, suspended: boolean): Promise<User> {
    await this.assertions.assertUserExists(workerId);

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      const updatedUser = await tx.user.update({
        where: { id: workerId },
        data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
      });

      if (suspended) {
        await tx.workerProfile.updateMany({
          where: { userId: workerId },
          data: { status: WorkerStatus.SUSPENDED, isOnline: false },
        });
      }
      // On unsuspend: WorkerProfile.status is intentionally NOT restored to VERIFIED.
      // Use PATCH /admin/workers/:id/reinstate (with auditNote) to return a worker
      // to VERIFIED — that is the correct path per WRK-05 / BR-06.

      return updatedUser;
    });
  }

  async reinstateWorker(
    workerProfileId: string,
    dto: ReinstateWorkerDto,
    admin: AuthJwtPayload,
  ): Promise<WorkerProfile> {
    const worker = await this.assertions.findSuspendedWorker(workerProfileId);
    this.logger.log(
      `Worker ${worker.id} reinstated by ${admin.sub}. Note: ${dto.auditNote}`,
    );
    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.user.update({
        where: { id: worker.userId },
        data: { status: UserStatus.ACTIVE },
      });
      return tx.workerProfile.update({
        where: { id: worker.id },
        data: { status: WorkerStatus.VERIFIED, strikeCount: 0 },
      });
    });
  }

  async strikeWorker(
    user: AuthJwtPayload,
    dto: StrikeWorkerDto,
  ): Promise<WorkerProfile> {
    const worker = await this.assertions.findWorkerProfile(dto.workerId);
    await this.assertions.assertBookingExists(dto.bookingId);

    return this.prisma.$transaction((tx: TransactionClient) =>
      applyStrike(tx, worker.id, {
        bookingId: dto.bookingId,
        reason: dto.reason,
        issuedBy: user.sub,
        notes: dto.notes,
      }),
    );
  }

  async findPendingNoShows(
    query: PaginationDto,
  ): Promise<Paginated<PendingNoShow>> {
    const where = { confirmed: null, reportType: NoShowReportType.WORKER };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.noShowReport.findMany({
        where,
        include: {
          booking: {
            include: {
              worker: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  userId: true,
                },
              },
              customer: { select: { firstName: true, lastName: true } },
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.noShowReport.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async findPendingCustomerNoShows(
    query: PaginationDto,
  ): Promise<Paginated<PendingCustomerNoShow>> {
    const where = { confirmed: null, reportType: NoShowReportType.CUSTOMER };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.noShowReport.findMany({
        where,
        include: {
          booking: {
            include: {
              worker: { select: { id: true, firstName: true, lastName: true } },
              customer: {
                select: { firstName: true, lastName: true, userId: true },
              },
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.noShowReport.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async resolveCustomerNoShow(
    reportId: string,
    user: AuthJwtPayload,
    dto: ResolveNoShowDto,
  ): Promise<NoShowResolution> {
    const report =
      await this.assertions.findPendingCustomerNoShowReport(reportId);

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.noShowReport.update({
        where: { id: reportId },
        data: {
          confirmed: dto.confirmed,
          resolvedBy: user.sub,
          resolvedAt: new Date(),
        },
      });

      if (dto.confirmed) {
        await tx.booking.update({
          where: { id: report.bookingId },
          data: { status: BookingStatus.CUSTOMER_NO_SHOW },
        });
      }

      return { resolved: true, confirmed: dto.confirmed };
    });
  }

  async resolveNoShow(
    reportId: string,
    user: AuthJwtPayload,
    dto: ResolveNoShowDto,
  ): Promise<NoShowResolution> {
    const report = await this.assertions.findPendingNoShowReport(reportId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        await tx.noShowReport.update({
          where: { id: reportId },
          data: {
            confirmed: dto.confirmed,
            resolvedBy: user.sub,
            resolvedAt: new Date(),
          },
        });

        if (dto.confirmed) {
          await applyStrike(tx, report.booking.workerId, {
            bookingId: report.bookingId,
            reason: StrikeReason.NO_SHOW,
            issuedBy: user.sub,
            notes: dto.notes,
          });

          await tx.booking.update({
            where: { id: report.bookingId },
            data: { status: BookingStatus.NO_SHOW },
          });
        }

        return { resolved: true, confirmed: dto.confirmed };
      })
      .then((result) => {
        if (dto.confirmed) {
          void this.notifications
            .sendToUser(report.booking.worker.userId, {
              title: 'No-show confirmed',
              body: 'A no-show report against you has been confirmed. A strike has been issued.',
            })
            .catch(() => {});
        }
        return result;
      });
  }

  async findUsers(
    query: FindUsersQueryDto,
  ): Promise<Paginated<AdminUserListItem>> {
    const where = {
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async findWorkers(
    query: FindWorkersQueryDto,
  ): Promise<Paginated<AdminWorkerListItem>> {
    const where = {
      ...(query.status && { status: query.status }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workerProfile.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          strikeCount: true,
          averageRating: true,
          totalJobsCompleted: true,
          createdAt: true,
          user: { select: { phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.workerProfile.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async findBookings(
    query: FindBookingsQueryDto,
  ): Promise<Paginated<AdminBookingListItem>> {
    const where = {
      ...(query.status && { status: query.status }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
          worker: { select: { firstName: true, lastName: true } },
          customer: { select: { firstName: true, lastName: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async findPendingCredentials(
    query: PaginationDto,
  ): Promise<Paginated<PendingCredential>> {
    const where = { status: VerificationStatus.PENDING };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workerCredential.findMany({
        where,
        include: { worker: { include: ADMIN_WORKER_INCLUDE } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.workerCredential.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async approveCredential(
    credentialId: string,
    user: AuthJwtPayload,
  ): Promise<WorkerCredential> {
    const credential =
      await this.assertions.findPendingCredential(credentialId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        return tx.workerCredential.update({
          where: { id: credentialId },
          data: {
            status: VerificationStatus.APPROVED,
            reviewedBy: user.sub,
            reviewedAt: new Date(),
          },
        });
      })
      .then((result) => {
        void this.notifications
          .sendToUser(credential.worker.userId, {
            title: 'Credential approved',
            body: `Your ${credential.type.toLowerCase()} credential has been verified.`,
          })
          .catch(() => {});
        return result;
      });
  }

  async rejectCredential(
    credentialId: string,
    user: AuthJwtPayload,
    reason: string,
  ): Promise<WorkerCredential> {
    const credential =
      await this.assertions.findPendingCredential(credentialId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        return tx.workerCredential.update({
          where: { id: credentialId },
          data: {
            status: VerificationStatus.REJECTED,
            rejectionReason: reason,
            reviewedBy: user.sub,
            reviewedAt: new Date(),
          },
        });
      })
      .then((result) => {
        void this.notifications
          .sendToUser(credential.worker.userId, {
            title: 'Credential rejected',
            body: reason,
          })
          .catch(() => {});
        return result;
      });
  }

  async findAllReviews(
    query: FindReviewsAdminQueryDto,
  ): Promise<Paginated<AdminReviewListItem>> {
    const where = { ...(query.workerId && { workerId: query.workerId }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: {
          worker: { select: { firstName: true, lastName: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async deleteReview(reviewId: string): Promise<{ deleted: boolean }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.review.delete({ where: { id: reviewId } });

      const { _avg, _count } = await tx.review.aggregate({
        where: { workerId: review.workerId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.workerProfile.update({
        where: { id: review.workerId },
        data: computeWorkerRatingUpdate(_avg.rating ?? 0, _count),
      });

      return { deleted: true };
    });
  }
}
