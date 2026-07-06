import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStatus, Role, StrikeReason, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';
import { AuthJwtPayload } from '../auth/auth.types';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { NotificationsService } from '@/modules/notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findPendingVerifications(user: AuthJwtPayload) {
    await this.assertAdminRole(user.role)
    
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
    await this.assertAdminRole(user.role)

    const doc = await this.getPendingVerification(docId);

    await this.assertWorkerIsUnverified(doc.workerId)

    return this.prisma.$transaction(async (tx: TransactionClient) => {
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

  async rejectVerification(docId: string, user: AuthJwtPayload, reason: string) {
    await this.assertAdminRole(user.role)

    const doc = await this.getPendingVerification(docId);

    return this.prisma.$transaction(async (tx: TransactionClient) => {

      const previousRejections = await tx.verificationDoc.count({
        where: {
          workerId: doc.workerId,
          status: VerificationStatus.REJECTED,
        },
      });
      const secondRejection = previousRejections + 1 >= 2;

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

  async setUserSuspension(user: AuthJwtPayload, workerId: string, suspended: boolean) {
    await this.assertAdminRole(user.role)

    await this.assertUserExist(workerId)

    return this.prisma.$transaction(async (tx: TransactionClient) => {

      const updatedUser =  await tx.user.update({
        where: { id: workerId },
        data: {
          status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE
        }
      })

      if(suspended) {
        await tx.workerProfile.updateMany({
          where: { userId: workerId },
          data: {
            status: WorkerStatus.SUSPENDED,
            isOnline: false
          }
        })
      }

      return updatedUser
    })
  }

  async strikeWorker(user: AuthJwtPayload, dto: StrikeWorkerDto) {
    await this.assertAdminRole(user.role)
    const worker = await this.assertWorkerProfileExist(dto.workerId)

    if (dto.bookingId) {
      await this.assertBookingExist(dto.bookingId)
      await this.assertBookingNotAlreadyStruck(dto.bookingId)
    }

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.strike.create({
        data: {
          issuedBy: user.sub,
          workerId: worker.id,
          bookingId: dto.bookingId,
          reason: dto.reason,
          notes: dto.notes,
        },
      })

      const updatedWorker = await tx.workerProfile.update({
        where: { id: worker.id },
        data: { strikeCount: { increment: 1 } },
      })

      if (updatedWorker.strikeCount >= 3) {
        await tx.workerProfile.update({
          where: { id: worker.id },
          data: { status: WorkerStatus.SUSPENDED, isOnline: false },
        })
      }

      return updatedWorker
    })
  }


  async findPendingNoShows(user: AuthJwtPayload) {
    await this.assertAdminRole(user.role)

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
    })
  }

  async resolveNoShow(reportId: string, user: AuthJwtPayload, dto: ResolveNoShowDto) {
    await this.assertAdminRole(user.role)

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
    })

    if (!report) throw new NotFoundException('No-show report not found.')
    if (report.confirmed !== null) throw new ConflictException('This report has already been resolved.')

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.noShowReport.update({
        where: { id: reportId },
        data: { confirmed: dto.confirmed, resolvedBy: user.sub, resolvedAt: new Date() },
      })

      if (dto.confirmed) {
        await this.assertBookingNotAlreadyStruck(report.bookingId)

        await tx.strike.create({
          data: {
            workerId: report.booking.workerId,
            bookingId: report.bookingId,
            reason: StrikeReason.NO_SHOW,
            issuedBy: user.sub,
            notes: dto.notes,
          },
        })

        const updatedWorker = await tx.workerProfile.update({
          where: { userId: report.booking.workerId },
          data: { strikeCount: { increment: 1 } },
        })

        if (updatedWorker.strikeCount >= 3) {
          await tx.workerProfile.update({
            where: { id: updatedWorker.id },
            data: { status: WorkerStatus.SUSPENDED, isOnline: false },
          })
        }

        await tx.booking.update({
          where: { id: report.bookingId },
          data: { status: BookingStatus.NO_SHOW },
        })
      }

      return { resolved: true, confirmed: dto.confirmed }
    }).then((result) => {
      if (dto.confirmed) {
        void this.notifications.sendToUser(report.booking.worker.userId, {
          title: 'No-show confirmed',
          body: 'A no-show report against you has been confirmed. A strike has been issued.',
        }).catch(() => {})
      }
      return result
    })
  }

  private async assertAdminRole(role: Role) {
    if(role !== Role.ADMIN) {
      throw new ForbiddenException("Admin role is required.")
    }
  }

  private async getPendingVerification(id: string) {
    const doc = await this.assertDocExist(id);

    if (doc.status !== VerificationStatus.PENDING) {
      throw new ConflictException('Verification submission has already been reviewed');
    }

    return doc;
  }

  private async assertUserExist(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })

    if(!user) {
      throw new NotFoundException("User not found.")
    } 

    return user
  }

  private async assertWorkerProfileExist(workerId: string) {
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: workerId } })

    if(!worker) {
      throw new NotFoundException("Worker profile does not exist.");
    }

    return worker
  }

  private async assertDocExist(docId: string) {
    const doc = await this.prisma.verificationDoc.findUnique({ where: { id: docId } })

    if(!doc) {
      throw new NotFoundException("Verification submission not found.")
    }

    return doc
  }

  private async assertBookingExist(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })

    if(!booking) {
      throw new NotFoundException("Booking not found.")
    }

    return booking
  }

  private async assertWorkerIsUnverified(workerId: string) {
    const worker = await this.assertWorkerProfileExist(workerId)

    if(worker.status === WorkerStatus.VERIFIED) {
      throw new ConflictException("Worker is already verified.")
    }
    
    return worker
  }


  private async assertBookingNotAlreadyStruck(bookingId: string) {
    const existingStrike = await this.prisma.strike.findUnique({ where: { bookingId } })

    if (existingStrike) {
      throw new ConflictException('This bookings has already been used for a strike.')
    }

    return existingStrike
  }

}
