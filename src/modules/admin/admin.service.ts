import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus, StrikeReason, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';
import { AuthJwtPayload } from '../auth/auth.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { assertExists } from '@/common/utils/assert.util';
import { WORKER_INCLUDE } from '@/common/constants/worker-includes';

const STRIKE_SUSPENSION_THRESHOLD = 3;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findPendingVerifications(user: AuthJwtPayload) {
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

  async approveVerification(docId: string, user: AuthJwtPayload) {
    const doc = await this.getPendingVerification(docId);
    await this.assertWorkerIsUnverified(doc.workerId);

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

  async rejectVerification(docId: string, user: AuthJwtPayload, reason: string) {
    const doc = await this.getPendingVerification(docId);

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        const previousRejections = await tx.verificationDoc.count({
          where: { workerId: doc.workerId, status: VerificationStatus.REJECTED },
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
            status: isSecondRejection ? WorkerStatus.SUSPENDED : WorkerStatus.REJECTED,
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

  async setUserSuspension(user: AuthJwtPayload, workerId: string, suspended: boolean) {
    await assertExists(
      () => this.prisma.user.findUnique({ where: { id: workerId } }),
      'User not found.',
    );

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
    const worker = await assertExists(
      () => this.prisma.workerProfile.findUnique({ where: { id: dto.workerId } }),
      'Worker profile does not exist.',
    );

    if (dto.bookingId) {
      await assertExists(
        () => this.prisma.booking.findUnique({ where: { id: dto.bookingId } }),
        'Booking not found.',
      );
      await this.assertBookingNotAlreadyStruck(dto.bookingId);
    }

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await this.createStrikeRecord(tx, {
        workerId: worker.id,
        bookingId: dto.bookingId,
        reason: dto.reason,
        issuedBy: user.sub,
        notes: dto.notes,
      });

      return this.incrementStrikeAndSuspendIfNeeded(tx, { id: worker.id });
    });
  }

  async findPendingNoShows(user: AuthJwtPayload) {
    return this.prisma.noShowReport.findMany({
      where: { confirmed: null },
      include: {
        booking: {
          include: {
            worker: { select: { id: true, firstName: true, lastName: true, userId: true } },
            customer: { select: { firstName: true, lastName: true } },
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveNoShow(reportId: string, user: AuthJwtPayload, dto: ResolveNoShowDto) {
    const report = await assertExists(
      () =>
        this.prisma.noShowReport.findUnique({
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
        }),
      'No-show report not found.',
    );

    if (report.confirmed !== null) {
      throw new ConflictException('This report has already been resolved.');
    }

    return this.prisma
      .$transaction(async (tx: TransactionClient) => {
        await tx.noShowReport.update({
          where: { id: reportId },
          data: { confirmed: dto.confirmed, resolvedBy: user.sub, resolvedAt: new Date() },
        });

        if (dto.confirmed) {
          await this.assertBookingNotAlreadyStruck(report.bookingId);

          await this.createStrikeRecord(tx, {
            workerId: report.booking.workerId,
            bookingId: report.bookingId,
            reason: StrikeReason.NO_SHOW,
            issuedBy: user.sub,
            notes: dto.notes,
          });

          await this.incrementStrikeAndSuspendIfNeeded(tx, { userId: report.booking.workerId });

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

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async getPendingVerification(id: string) {
    const doc = await assertExists(
      () =>
        this.prisma.verificationDoc.findUnique({
          where: { id },
          include: { worker: { select: { userId: true } } },
        }),
      'Verification submission not found.',
    );

    if (doc.status !== VerificationStatus.PENDING) {
      throw new ConflictException('Verification submission has already been reviewed');
    }

    return doc;
  }

  private async assertWorkerIsUnverified(workerId: string) {
    const worker = await assertExists(
      () => this.prisma.workerProfile.findUnique({ where: { id: workerId } }),
      'Worker profile does not exist.',
    );

    if (worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException('Worker is already verified.');
    }

    return worker;
  }

  private async assertBookingNotAlreadyStruck(bookingId: string): Promise<void> {
    const existingStrike = await this.prisma.strike.findUnique({ where: { bookingId } });

    if (existingStrike) {
      throw new ConflictException('This booking has already been used for a strike.');
    }
  }

  private async createStrikeRecord(
    tx: TransactionClient,
    data: {
      workerId: string;
      bookingId?: string;
      reason: StrikeReason;
      issuedBy: string;
      notes?: string;
    },
  ): Promise<void> {
    await tx.strike.create({ data });
  }

  private async incrementStrikeAndSuspendIfNeeded(
    tx: TransactionClient,
    where: { id: string } | { userId: string },
  ) {
    const updated = await tx.workerProfile.update({
      where,
      data: { strikeCount: { increment: 1 } },
    });

    if (updated.strikeCount >= STRIKE_SUSPENSION_THRESHOLD) {
      await tx.workerProfile.update({
        where: { id: updated.id },
        data: { status: WorkerStatus.SUSPENDED, isOnline: false },
      });
    }

    return updated;
  }
}
