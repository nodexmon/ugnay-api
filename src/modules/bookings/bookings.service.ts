import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingStatus,
  CancellationActor,
  Role,
  StrikeReason,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthJwtPayload } from '../auth/auth.types';
import { Booking, User } from '@/generated/prisma/client';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import {
  BOOKING_MAX_ADVANCE_MS,
  BOOKING_PENDING_EXPIRY_MS,
  CONTACT_REVEAL_STATUSES,
} from './bookings.constants';
import { STRIKE_SUSPENSION_THRESHOLD } from '@/modules/admin/admin.constants';
import { BookingsAssertions } from './bookings.assertions';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { UsersAssertions } from '../users/users.assertions';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: BookingsAssertions,
    private readonly usersAssertions: UsersAssertions,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async findOne(bookingId: string, user: AuthJwtPayload) {
    const ownershipWhere =
      user.role === Role.CUSTOMER
        ? { customer: { userId: user.sub } }
        : { worker: { userId: user.sub } };

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, ...ownershipWhere },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            averageRating: true,
            baseRate: true,
            user: { select: { phone: true } },
          },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            user: { select: { phone: true } },
          },
        },
        category: { select: { name: true, iconUrl: true } },
        barangay: { select: { name: true } },
        review: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found.');

    const revealContact = CONTACT_REVEAL_STATUSES.has(booking.status);
    const { worker, customer, ...rest } = booking;
    return {
      ...rest,
      worker: { ...worker, user: revealContact ? worker.user : undefined },
      customer: {
        ...customer,
        user: revealContact ? customer.user : undefined,
      },
    };
  }

  async findMany(user: AuthJwtPayload, query: FindBookingsQueryDto) {
    const activeStatuses = [
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
      BookingStatus.IN_PROGRESS,
    ];
    const historyStatuses = [
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED,
      BookingStatus.EXPIRED,
      BookingStatus.NO_SHOW,
    ];
    const isCustomer = user.role === Role.CUSTOMER;

    return this.prisma.booking.findMany({
      where: {
        ...(isCustomer
          ? { customer: { userId: user.sub } }
          : { worker: { userId: user.sub } }),
        ...(query.status === 'active' && { status: { in: activeStatuses } }),
        ...(query.status === 'history' && { status: { in: historyStatuses } }),
      },
      include: {
        worker: isCustomer
          ? {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
                averageRating: true,
              },
            }
          : false,
        customer: isCustomer
          ? false
          : { select: { firstName: true, lastName: true, avatarUrl: true } },
        category: { select: { name: true, iconUrl: true } },
        barangay: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.take,
    });
  }

  async create(user: AuthJwtPayload, dto: CreateBookingDto) {
    await this.usersAssertions.assertUserIsActive(user.sub);

    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found.');
    }

    await this.assertions.assertWorkerIsAvailable(dto.workerId);

    const maxScheduledDate = new Date(Date.now() + BOOKING_MAX_ADVANCE_MS);
    if (dto.scheduledDate > maxScheduledDate) {
      throw new BadRequestException('Scheduled booking must be within 7 days.');
    }

    const booking = await this.prisma.booking.create({
      data: {
        customerId: customer.id,
        status: BookingStatus.PENDING,
        expiresAt: new Date(Date.now() + BOOKING_PENDING_EXPIRY_MS),
        ...dto,
      },
    });

    void this.notifyBookingParty(booking.id, 'worker', {
      title: 'New booking request',
      body: 'A customer has requested your service.',
    }).catch(() => {});

    return booking;
  }

  async update(bookingId: string, user: AuthJwtPayload, dto: UpdateBookingDto) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.PENDING,
    );
    this.assertions.assertOwnership(booking.customerId, profileId);
    await this.prisma.booking.update({ where: { id: bookingId }, data: dto });
  }

  async accept(bookingId: string, user: AuthJwtPayload) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.PENDING,
    );
    this.assertions.assertOwnership(booking.workerId, profileId);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACCEPTED, acceptedAt: new Date() },
    });
    void this.notifyBookingParty(bookingId, 'customer', {
      title: 'Booking accepted',
      body: 'Your booking has been accepted.',
    }).catch(() => {});
  }

  async reject(bookingId: string, user: AuthJwtPayload) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.PENDING,
    );
    this.assertions.assertOwnership(booking.workerId, profileId);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.REJECTED, rejectedAt: new Date() },
    });
    void this.notifyBookingParty(bookingId, 'customer', {
      title: 'Booking declined',
      body: 'The worker has declined your booking request.',
    }).catch(() => {});
  }

  async start(bookingId: string, user: AuthJwtPayload) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.ACCEPTED,
    );
    this.assertions.assertOwnership(booking.workerId, profileId);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.IN_PROGRESS, startedAt: new Date() },
    });
  }

  async complete(bookingId: string, user: AuthJwtPayload) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.IN_PROGRESS,
    );
    this.assertions.assertOwnership(booking.workerId, profileId);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });
    void this.notifyBookingParty(bookingId, 'customer', {
      title: 'Job complete',
      body: 'The job is done. Leave a review for your worker!',
    }).catch(() => {});
  }

  async cancel(bookingId: string, user: AuthJwtPayload, dto: CancelBookingDto) {
    if (user.role !== Role.CUSTOMER && user.role !== Role.WORKER) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const activeUser = await this.usersAssertions.assertUserIsActive(user.sub);
    const booking = await this.assertions.assertBookingExists(bookingId);
    const profileId = await this.getProfileId(user.sub, user.role);

    if (user.role === Role.CUSTOMER) {
      this.assertions.assertOwnership(booking.customerId, profileId);
      this.assertions.assertBookingInStatus(
        booking.status,
        BookingStatus.PENDING,
      );
    }

    if (user.role === Role.WORKER) {
      this.assertions.assertOwnership(booking.workerId, profileId);
      this.assertions.assertBookingInStatus(
        booking.status,
        BookingStatus.ACCEPTED,
        BookingStatus.IN_PROGRESS,
      );
    }

    await this.prisma.$transaction(async (tx: TransactionClient) => {
      if (user.role === Role.WORKER) {
        await this.handleWorkerCancellationPenalty(tx, activeUser);
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationActor:
            user.role === Role.WORKER
              ? CancellationActor.WORKER
              : CancellationActor.CUSTOMER,
          cancellationReason: dto.cancellationReason,
        },
      });
    });

    if (user.role === Role.WORKER) {
      void this.notifyBookingParty(bookingId, 'customer', {
        title: 'Booking cancelled',
        body: 'The worker has cancelled the booking.',
      }).catch(() => {});
    } else {
      void this.notifyBookingParty(bookingId, 'worker', {
        title: 'Booking cancelled',
        body: 'The customer has cancelled the booking.',
      }).catch(() => {});
    }
  }

  async reportNoShow(
    bookingId: string,
    user: AuthJwtPayload,
    description?: string,
  ) {
    const { activeUser, booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.ACCEPTED,
      BookingStatus.IN_PROGRESS,
    );
    this.assertions.assertOwnership(booking.customerId, profileId);
    await this.assertions.assertNoReportExists(booking.id);

    return this.prisma.noShowReport.create({
      data: { bookingId, reportedBy: activeUser.id, description },
    });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private async getProfileId(userId: string, role: Role): Promise<string> {
    if (role === Role.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException('Customer profile not found.');
      return profile.id;
    }
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Worker profile not found.');
    return profile.id;
  }

  private async prepareBookingAction(
    userId: string,
    role: Role,
    bookingId: string,
    ...allowedStatuses: BookingStatus[]
  ): Promise<{ activeUser: User; booking: Booking; profileId: string }> {
    const activeUser = await this.usersAssertions.assertUserIsActive(userId);
    const booking = await this.assertions.assertBookingExists(bookingId);

    this.assertions.assertBookingInStatus(booking.status, ...allowedStatuses);

    const profileId = await this.getProfileId(userId, role);

    return { activeUser, booking, profileId };
  }

  private async handleWorkerCancellationPenalty(
    tx: TransactionClient,
    worker: User,
  ): Promise<void> {
    const workerProfile = await tx.workerProfile.update({
      where: { userId: worker.id },
      data: { strikeCount: { increment: 1 } },
    });

    await tx.strike.create({
      data: {
        workerId: workerProfile.id,
        reason: StrikeReason.POST_ACCEPT_CANCELLATION,
        issuedBy: 'SYSTEM',
      },
    });

    if (workerProfile.strikeCount >= STRIKE_SUSPENSION_THRESHOLD) {
      await tx.workerProfile.update({
        where: { id: workerProfile.id },
        data: { status: WorkerStatus.SUSPENDED, isOnline: false },
      });
    }
  }

  private async notifyBookingParty(
    bookingId: string,
    party: 'worker' | 'customer',
    message: { title: string; body: string },
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        worker: { select: { userId: true } },
        customer: { select: { userId: true } },
      },
    });
    if (!booking) return;
    const userId =
      party === 'worker' ? booking.worker.userId : booking.customer.userId;
    await this.notifications.sendToUser(userId, message);
  }
}
