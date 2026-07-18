import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BookingStatus,
  StrikeReason,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
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
import { AdminAssertions } from './admin.assertions';
import { BarangaySyncService } from '@/modules/barangays/barangay-sync.service';
import { applyStrike } from '@/common/utils/strike.util';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly assertions: AdminAssertions,
    private readonly barangaySync: BarangaySyncService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  syncBarangays() {
    return this.barangaySync.syncBarangays();
  }

  async findPendingVerifications(query: PaginationDto) {
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

  async approveVerification(docId: string, user: AuthJwtPayload) {
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
  ) {
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

  async setUserSuspension(workerId: string, suspended: boolean) {
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

      return updatedUser;
    });
  }

  async strikeWorker(user: AuthJwtPayload, dto: StrikeWorkerDto) {
    const worker = await this.assertions.findWorkerProfile(dto.workerId);
    if (dto.bookingId) {
      await this.assertions.assertBookingExists(dto.bookingId);
    }

    return this.prisma.$transaction((tx: TransactionClient) =>
      applyStrike(tx, worker.id, {
        bookingId: dto.bookingId,
        reason: dto.reason,
        issuedBy: user.sub,
        notes: dto.notes,
      }),
    );
  }

  async findPendingNoShows(query: PaginationDto) {
    const where = { confirmed: null };
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

  async resolveNoShow(
    reportId: string,
    user: AuthJwtPayload,
    dto: ResolveNoShowDto,
  ) {
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

    if (!report) throw new NotFoundException('No-show report not found.');

    if (report.confirmed !== null) {
      throw new ConflictException('This report has already been resolved.');
    }

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

  async findUsers(query: FindUsersQueryDto) {
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

  async findWorkers(query: FindWorkersQueryDto) {
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

  async findBookings(query: FindBookingsQueryDto) {
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

  async findPendingCredentials(query: PaginationDto) {
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

  async approveCredential(credentialId: string, user: AuthJwtPayload) {
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
  ) {
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
}
