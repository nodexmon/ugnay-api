import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingStatus,
  BookingType,
  CancellationActor,
  NoShowReportType,
  Role,
  StrikeReason,
} from '@/generated/prisma/enums';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthJwtPayload } from '../auth/auth.types';
import { Booking, User } from '@/generated/prisma/client';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { BOOKING_PENDING_EXPIRY_MS, PST_OFFSET_MS } from './bookings.constants';
import { BookingsAssertions } from './bookings.assertions';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { UsersAssertions } from '../users/users.assertions';
import { applyStrike } from '@/common/utils/strike.util';
import { BOOKING_PARTY_IDS_INCLUDE } from '@/common/constants/booking-selects';

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
    const bookingInclude = {
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
    };

    if (user.role === Role.ADMIN) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId },
        include: bookingInclude,
      });
      if (!booking) throw new NotFoundException('Booking not found.');
      return booking;
    }

    const ownershipWhere =
      user.role === Role.CUSTOMER
        ? { customer: { userId: user.sub } }
        : { worker: { userId: user.sub } };

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, ...ownershipWhere },
      include: bookingInclude,
    });

    if (!booking) throw new NotFoundException('Booking not found.');

    const revealContact = booking.acceptedAt !== null;
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
      BookingStatus.CUSTOMER_NO_SHOW,
    ];
    const isCustomer = user.role === Role.CUSTOMER;

    const where = {
      ...(isCustomer
        ? { customer: { userId: user.sub } }
        : { worker: { userId: user.sub } }),
      ...(query.status === 'active' && { status: { in: activeStatuses } }),
      ...(query.status === 'history' && { status: { in: historyStatuses } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
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
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, skip: query.skip, take: query.take };
  }

  async create(user: AuthJwtPayload, dto: CreateBookingDto) {
    await this.usersAssertions.findActiveUser(user.sub);

    const customerId = await this.assertions.resolveProfileId(
      user.sub,
      Role.CUSTOMER,
    );

    await this.assertions.assertWorkerIsAvailable(dto.workerId);
    this.assertions.assertScheduledDateIsValid(dto.scheduledDate);
    await this.assertions.assertWorkerServesBarangay(
      dto.workerId,
      dto.barangayId,
    );
    const agreedRate = await this.assertions.findWorkerCategoryRate(
      dto.workerId,
      dto.categoryId,
    );

    const toDayMs = (d: Date) => {
      const p = new Date(d.getTime() + PST_OFFSET_MS);
      return Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
    };
    const bookingType =
      toDayMs(dto.scheduledDate) === toDayMs(new Date())
        ? BookingType.IMMEDIATE
        : BookingType.SCHEDULED;

    let booking;
    try {
      booking = await this.prisma.booking.create({
        data: {
          customerId,
          status: BookingStatus.PENDING,
          expiresAt: new Date(Date.now() + BOOKING_PENDING_EXPIRY_MS),
          ...dto,
          bookingType,
          agreedRate,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Worker already has an active booking.');
      }
      throw e;
    }

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
    if (dto.scheduledDate) {
      this.assertions.assertScheduledDateIsValid(dto.scheduledDate);
    }
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
    const { count: acceptCount } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.ACCEPTED, acceptedAt: new Date() },
    });
    if (acceptCount === 0)
      throw new ConflictException('Booking is no longer pending.');
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
    const { count: rejectCount } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.REJECTED, rejectedAt: new Date() },
    });
    if (rejectCount === 0)
      throw new ConflictException('Booking is no longer pending.');
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
    const { count: startCount } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.ACCEPTED },
      data: { status: BookingStatus.IN_PROGRESS, startedAt: new Date() },
    });
    if (startCount === 0)
      throw new ConflictException('Booking is no longer accepted.');
  }

  async complete(bookingId: string, user: AuthJwtPayload) {
    const { booking, profileId } = await this.prepareBookingAction(
      user.sub,
      user.role,
      bookingId,
      BookingStatus.IN_PROGRESS,
    );
    this.assertions.assertOwnership(booking.workerId, profileId);
    await this.prisma.$transaction(async (tx: TransactionClient) => {
      const { count: completeCount } = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.IN_PROGRESS },
        data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
      });
      if (completeCount === 0)
        throw new ConflictException('Booking is no longer in progress.');
      await tx.workerProfile.update({
        where: { id: booking.workerId },
        data: { totalJobsCompleted: { increment: 1 } },
      });
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

    await this.usersAssertions.findActiveUser(user.sub);
    const booking = await this.assertions.findBooking(bookingId);
    const profileId = await this.assertions.resolveProfileId(
      user.sub,
      user.role,
    );

    if (user.role === Role.CUSTOMER) {
      this.assertions.assertOwnership(booking.customerId, profileId);
      this.assertions.assertBookingInStatus(
        booking.status,
        BookingStatus.PENDING,
        BookingStatus.ACCEPTED,
      );
    }

    if (user.role === Role.WORKER) {
      this.assertions.assertOwnership(booking.workerId, profileId);
      this.assertions.assertBookingInStatus(
        booking.status,
        BookingStatus.ACCEPTED,
        BookingStatus.IN_PROGRESS,
      );
      if (!dto.cancellationReason) {
        throw new BadRequestException('Cancellation reason is required.');
      }
    }

    const expectedStatuses =
      user.role === Role.CUSTOMER
        ? [BookingStatus.PENDING, BookingStatus.ACCEPTED]
        : [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS];

    await this.prisma.$transaction(async (tx: TransactionClient) => {
      if (user.role === Role.WORKER) {
        await applyStrike(tx, profileId, {
          bookingId,
          reason: StrikeReason.POST_ACCEPT_CANCELLATION,
          issuedBy: 'SYSTEM',
        });
      }

      const { count: cancelCount } = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: expectedStatuses } },
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

      if (cancelCount === 0) {
        throw new ConflictException('Booking status has changed.');
      }
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
    this.assertions.assertNoShowWindowOpen(booking);
    await this.assertions.assertNoReportExists(booking.id);

    return this.prisma.noShowReport.create({
      data: {
        bookingId,
        reportedBy: activeUser.id,
        description,
        reportType: NoShowReportType.WORKER,
      },
    });
  }

  async reportCustomerNoShow(
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
    this.assertions.assertOwnership(booking.workerId, profileId);
    this.assertions.assertNoShowWindowOpen(booking);
    await this.assertions.assertNoReportExists(booking.id);

    return this.prisma.noShowReport.create({
      data: {
        bookingId,
        reportedBy: activeUser.id,
        description,
        reportType: NoShowReportType.CUSTOMER,
      },
    });
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private async prepareBookingAction(
    userId: string,
    role: Role,
    bookingId: string,
    ...allowedStatuses: BookingStatus[]
  ): Promise<{ activeUser: User; booking: Booking; profileId: string }> {
    const activeUser = await this.usersAssertions.findActiveUser(userId);
    const booking = await this.assertions.findBooking(bookingId);

    this.assertions.assertBookingInStatus(booking.status, ...allowedStatuses);

    const profileId = await this.assertions.resolveProfileId(userId, role);

    return { activeUser, booking, profileId };
  }

  private async notifyBookingParty(
    bookingId: string,
    party: 'worker' | 'customer',
    message: { title: string; body: string },
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_PARTY_IDS_INCLUDE,
    });
    if (!booking) return;
    const userId =
      party === 'worker' ? booking.worker.userId : booking.customer.userId;
    await this.notifications.sendToUser(userId, message);
  }
}
