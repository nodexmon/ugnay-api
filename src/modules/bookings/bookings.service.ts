import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, CancellationActor, Role, StrikeReason, UserStatus, WorkerStatus } from '@/generated/prisma/enums';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingAction } from './booking.types';
import { AuthJwtPayload } from '../auth/auth.types';
import { Booking, User } from '@/generated/prisma/client';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const ROLE_REQUIREMENTS: Partial<Record<BookingAction, Role>> = {
    [BookingAction.CREATE]: Role.CUSTOMER,
    [BookingAction.UPDATE]: Role.CUSTOMER,
    [BookingAction.REPORT_NO_SHOW]: Role.CUSTOMER,
    [BookingAction.ACCEPT]: Role.WORKER,
    [BookingAction.START]: Role.WORKER,
    [BookingAction.COMPLETE]: Role.WORKER,
    [BookingAction.REJECT]: Role.WORKER,
};

const CONTACT_REVEAL_STATUSES = new Set<BookingStatus>([
    BookingStatus.ACCEPTED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
]);

@Injectable()
export class BookingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) {}

    async findOne(bookingId: string, user: AuthJwtPayload) {
        const booking = await this.assertBookingExist(bookingId);

        const isOwner = user.role === Role.CUSTOMER
            ? booking.customerId === user.sub
            : booking.workerId === user.sub;

        if (!isOwner) throw new ForbiddenException('Insufficient permissions');

        const revealContact = CONTACT_REVEAL_STATUSES.has(booking.status);

        return this.prisma.booking.findUnique({
            where: { id: booking.id },
            include: {
                worker: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        averageRating: true,
                        baseRate: true,
                        user: revealContact ? { select: { phone: true } } : false,
                    },
                },
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        user: revealContact ? { select: { phone: true } } : false,
                    },
                },
                category: { select: { name: true, iconUrl: true } },
                barangay: { select: { name: true } },
                review: true,
            },
        });
    }

    async findMany(user: AuthJwtPayload, query: FindBookingsQueryDto) {
        const activeStatuses = [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS];
        const historyStatuses = [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW];
        const isCustomer = user.role === Role.CUSTOMER;

        return this.prisma.booking.findMany({
            where: {
                ...(isCustomer ? { customerId: user.sub } : { workerId: user.sub }),
                ...(query.status === 'active' && { status: { in: activeStatuses } }),
                ...(query.status === 'history' && { status: { in: historyStatuses } }),
            },
            include: {
                worker: isCustomer
                    ? { select: { firstName: true, lastName: true, avatarUrl: true, averageRating: true } }
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
        this.assertRole(user.role, BookingAction.CREATE);
        await this.assertUserIsActive(user.sub);
        await this.assertWorkerIsAvailable(dto.workerId);

        const maxScheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (dto.scheduledDate > maxScheduledDate) {
            throw new BadRequestException('Scheduled booking must be within 7 days');
        }

        const booking = await this.prisma.booking.create({
            data: {
                customerId: user.sub,
                status: BookingStatus.PENDING,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                ...dto,
            },
        });

        this.notify(booking.id, 'worker', { title: 'New booking request', body: 'A customer has requested your service.' });

        return booking;
    }

    async update(bookingId: string, user: AuthJwtPayload, dto: UpdateBookingDto) {
        this.assertRole(user.role, BookingAction.UPDATE);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, booking => booking.customerId, BookingStatus.PENDING);
        this.assertOwnership(booking.customerId, activeUser.id);
        await this.prisma.booking.update({ where: { id: bookingId }, data: dto });
    }

    async accept(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.ACCEPT);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, b => b.workerId, BookingStatus.PENDING);
        this.assertOwnership(booking.workerId, activeUser.id);
        await this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.ACCEPTED, acceptedAt: new Date() } });
        this.notify(bookingId, 'customer', { title: 'Booking accepted', body: 'Your booking has been accepted.' });
    }

    async reject(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.REJECT);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, b => b.workerId, BookingStatus.PENDING);
        this.assertOwnership(booking.workerId, activeUser.id);
        await this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.REJECTED, rejectedAt: new Date() } });
        this.notify(bookingId, 'customer', { title: 'Booking declined', body: 'The worker has declined your booking request.' });
    }

    async start(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.START);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, b => b.workerId, BookingStatus.ACCEPTED);
        this.assertOwnership(booking.workerId, activeUser.id);
        await this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.IN_PROGRESS, startedAt: new Date() } });
    }

    async complete(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.COMPLETE);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, b => b.workerId, BookingStatus.IN_PROGRESS);
        this.assertOwnership(booking.workerId, activeUser.id);
        await this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.COMPLETED, completedAt: new Date() } });
        this.notify(bookingId, 'customer', { title: 'Job complete', body: 'The job is done. Leave a review for your worker!' });
    }

    async cancel(bookingId: string, user: AuthJwtPayload, dto: CancelBookingDto) {
        const activeUser = await this.assertUserIsActive(user.sub);
        const booking = await this.assertBookingExist(bookingId);

        if (user.role === Role.CUSTOMER) {
            this.assertOwnership(booking.customerId, activeUser.id);
            this.assertBookingInStatus(booking, BookingStatus.PENDING);
        }

        if (user.role === Role.WORKER) {
            this.assertOwnership(booking.workerId, activeUser.id);
            this.assertBookingInStatus(booking, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS);
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
                    cancellationActor: user.role === Role.WORKER ? CancellationActor.WORKER : CancellationActor.CUSTOMER,
                    cancellationReason: dto.cancellationReason,
                },
            });
        });

        if (user.role === Role.WORKER) {
            this.notify(bookingId, 'customer', { title: 'Booking cancelled', body: 'The worker has cancelled the booking.' });
        } else {
            this.notify(bookingId, 'worker', { title: 'Booking cancelled', body: 'The customer has cancelled the booking.' });
        }
    }

    async reportNoShow(bookingId: string, user: AuthJwtPayload, description?: string) {
        this.assertRole(user.role, BookingAction.REPORT_NO_SHOW);
        const { activeUser, booking } = await this.prepareBookingAction(user.sub, bookingId, b => b.customerId, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS);
        this.assertOwnership(booking.customerId, activeUser.id);
        await this.assertNoReportExists(booking.id);

        return this.prisma.noShowReport.create({
            data: { bookingId, reportedBy: activeUser.id, description },
        });
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async prepareBookingAction(
        userId: string,
        bookingId: string,
        _ownerField: (booking: Booking) => string,
        ...allowedStatuses: BookingStatus[]
    ): Promise<{ activeUser: User; booking: Booking }> {
        const activeUser = await this.assertUserIsActive(userId);
        const booking = await this.assertBookingExist(bookingId);
        this.assertBookingInStatus(booking, ...allowedStatuses);
        return { activeUser, booking };
    }

    private async handleWorkerCancellationPenalty(tx: TransactionClient, worker: User): Promise<void> {
        await tx.strike.create({
            data: {
                workerId: worker.id,
                bookingId: undefined,
                reason: StrikeReason.POST_ACCEPT_CANCELLATION,
                issuedBy: 'SYSTEM',
            },
        });

        const workerProfile = await tx.workerProfile.update({
            where: { userId: worker.id },
            data: { strikeCount: { increment: 1 } },
        });

        if (workerProfile.strikeCount >= 3) {
            await tx.workerProfile.update({
                where: { userId: worker.id },
                data: { status: WorkerStatus.SUSPENDED },
            });
        }
    }

    private assertOwnership(entityId: string, currentUserId: string): void {
        if (entityId !== currentUserId) {
            throw new ForbiddenException('Insufficient permissions.');
        }
    }

    private assertRole(role: Role, action: BookingAction): void {
        const required = ROLE_REQUIREMENTS[action];
        if (required && role !== required) {
            throw new ForbiddenException('Insufficient Permissions.');
        }
    }

    private async assertUserIsActive(userId: string): Promise<User> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new ForbiddenException('Active user is required.');
        }
        return user;
    }

    private async assertBookingExist(bookingId: string): Promise<Booking> {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) throw new NotFoundException('Booking not found.');
        return booking;
    }

    private assertBookingInStatus(booking: Booking, ...allowed: BookingStatus[]): void {
        if (!allowed.includes(booking.status)) {
            throw new ForbiddenException(`Booking must be in status: ${allowed.join(', ')}`);
        }
    }

    private async assertNoReportExists(bookingId: string): Promise<void> {
        const existingReport = await this.prisma.noShowReport.findUnique({ where: { bookingId } });
        if (existingReport) {
            throw new ForbiddenException('A no-show report already exists for this booking.');
        }
    }

    private async assertWorkerIsAvailable(workerId: string): Promise<void> {
        const activeBooking = await this.prisma.booking.findFirst({
            where: { workerId, status: { in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS] } },
        });
        if (activeBooking) throw new ForbiddenException('Worker is currently unavailable');
    }

    private notify(bookingId: string, party: 'worker' | 'customer', message: { title: string; body: string }): void {
        void (async () => {
            try {
                const booking = await this.prisma.booking.findUnique({
                    where: { id: bookingId },
                    include: {
                        worker: { select: { userId: true } },
                        customer: { select: { userId: true } },
                    },
                });
                if (!booking) return;
                const userId = party === 'worker' ? booking.worker.userId : booking.customer.userId;
                await this.notifications.sendToUser(userId, message);
            } catch {}
        })();
    }
}
