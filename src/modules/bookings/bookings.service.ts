import { PrismaService } from '@/prisma/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, CancellationActor, Role, StrikeReason, UserStatus, WorkerStatus } from '@/generated/prisma/enums';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingAction } from './booking.types';
import { AuthJwtPayload } from '../auth/auth.types';
import { Booking } from '@/generated/prisma/client';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';

@Injectable()
export class BookingsService {
    constructor(private readonly prisma: PrismaService) {}

    async findOne(bookingId: string, user: AuthJwtPayload) {
        const booking = await this.assertBookingExist(bookingId)

        const isOwner = user.role === Role.CUSTOMER 
                        ? booking.customerId === user.sub
                        : booking.workerId === user.sub
        
        if(!isOwner) {
            throw new ForbiddenException("Insufficient permissions")
        }

        const revealStatuses = new Set<BookingStatus>([
            BookingStatus.ACCEPTED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.COMPLETED
        ])

        const revealContact = revealStatuses.has(booking.status)

        return await this.prisma.booking.findUnique({
            where: { id: booking.id },
            include: {
                worker: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        averageRating: true,
                        baseRate: true,
                        user: revealContact ? { select: { phone: true } } : false
                    }
                },
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        user: revealContact ? { select: { phone: true } } : false
                    }
                },
                category: { select: { name: true, iconUrl: true } },
                barangay: { select: { name: true } },
                review: true
            }
        })
    }

    async findMany(user: AuthJwtPayload, query: FindBookingsQueryDto) {
        const activeStatuses = [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS]
        const historyStatuses = [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW]

        const isCustomer = user.role === Role.CUSTOMER

        return await this.prisma.booking.findMany({
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
            take: query.take
        })
    }

    async create(user: AuthJwtPayload, dto: CreateBookingDto) {
        this.assertRole(user.role, BookingAction.CREATE)
        await this.assertUserIsActive(user.sub)

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        const data = { 
            customerId: user.sub,
            status: BookingStatus.PENDING,
            expiresAt,
            ...dto
         }

        return await this.prisma.booking.create({ data })
    }

    async update(bookingId: string, user: AuthJwtPayload, dto: UpdateBookingDto) {
        this.assertRole(user.role, BookingAction.UPDATE)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.customerId, activeUser.id)

        await this.assertBookingInStatus(booking, BookingStatus.PENDING)

        await this.prisma.booking.update({
            where: {
                id: bookingId
            },
            data: {
                ...dto
            }
        })
    }

    async accept(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.ACCEPT)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.workerId, activeUser.id)
        
        await this.assertBookingInStatus(booking, BookingStatus.PENDING)

        await this.prisma.booking.update({
            where: {
                id: bookingId
            },
            data: {
                status: BookingStatus.ACCEPTED,
                acceptedAt: new Date()
            }
        })
    }

    async reject(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.REJECT)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.workerId, activeUser.id)
        
        await this.assertBookingInStatus(booking, BookingStatus.PENDING)

        await this.prisma.booking.update({
            where: {
                id: bookingId
            },
            data: {
                status: BookingStatus.REJECTED,
                rejectedAt: new Date()
            }
        })
    }

    async start(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.START)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.workerId, activeUser.id)

        await this.assertBookingInStatus(booking, BookingStatus.ACCEPTED)

        await this.prisma.booking.update({
            where: {
                id: bookingId,
            }, 
            data: {
                status: BookingStatus.IN_PROGRESS,
                startedAt: new Date()
            }
        })
    }

    async complete(bookingId: string, user: AuthJwtPayload) {
        this.assertRole(user.role, BookingAction.COMPLETE)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.workerId, activeUser.id)

        await this.assertBookingInStatus(booking, BookingStatus.IN_PROGRESS)
        await this.prisma.booking.update({
            where: {
                id: bookingId
            },
            data: {
                status: BookingStatus.COMPLETED,
                completedAt: new Date()
            }
        })
    }
    async cancel(bookingId: string, user: AuthJwtPayload, dto: CancelBookingDto) {
        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        if (user.role === Role.CUSTOMER) {
            this.assertOwnership(booking.customerId, activeUser.id)
            this.assertBookingInStatus(booking, BookingStatus.PENDING)
        }

        if (user.role === Role.WORKER) {
            this.assertOwnership(booking.workerId, activeUser.id)
            this.assertBookingInStatus(booking, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS)
        }

        await this.prisma.$transaction(async (tx) => {
            if (user.role === Role.WORKER) {
                await tx.strike.create({
                    data: {
                        workerId: activeUser.id,
                        bookingId: booking.id,
                        reason: StrikeReason.POST_ACCEPT_CANCELLATION,
                        issuedBy: 'SYSTEM'
                    }
                })

                const workerProfile = await tx.workerProfile.update({
                    where: { userId: activeUser.id },
                    data: { strikeCount: { increment: 1 } }
                })

                if (workerProfile.strikeCount >= 3) {
                    await tx.workerProfile.update({
                        where: { userId: activeUser.id },
                        data: { status: WorkerStatus.SUSPENDED }
                    })
                }
            }

            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancellationActor: user.role === Role.WORKER
                        ? CancellationActor.WORKER
                        : CancellationActor.CUSTOMER,
                    cancellationReason: dto.cancellationReason
                }
            })
        })
    }

    async reportNoShow(bookingId: string, user: AuthJwtPayload, description?: string) {
        this.assertRole(user.role, BookingAction.REPORT_NO_SHOW)

        const activeUser = await this.assertUserIsActive(user.sub)
        const booking = await this.assertBookingExist(bookingId)

        this.assertOwnership(booking.customerId, activeUser.id)
        this.assertBookingInStatus(booking, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS)

        const existingReport = await this.prisma.noShowReport.findUnique({
            where: { bookingId }
        })

        if (existingReport) {
            throw new ForbiddenException('A no-show report already exists for this booking.')
        }

        return await this.prisma.noShowReport.create({
            data: {
                bookingId,
                reportedBy: activeUser.id,
                description
            }
        })
    }

    private assertOwnership(entityId: string, currentUserId: string) {
        if(entityId !== currentUserId) {
            throw new ForbiddenException("Insufficient permissions.")
        }
    }

    private assertRole(role: Role, action: BookingAction) {

        const roleRequirements: Partial<Record<BookingAction, Role>> = {
            [BookingAction.CREATE]: Role.CUSTOMER,
            [BookingAction.UPDATE]: Role.CUSTOMER,
            [BookingAction.REPORT_NO_SHOW]: Role.CUSTOMER,
            [BookingAction.ACCEPT]: Role.WORKER,
            [BookingAction.START]: Role.WORKER,
            [BookingAction.COMPLETE]: Role.WORKER,
            [BookingAction.REJECT]: Role.WORKER,
        }

        const required = roleRequirements[action]

        if(required && role != required) {
            throw new ForbiddenException("Insufficient Permissions.")
        }

    }

    private async assertUserIsActive(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new ForbiddenException('Active user is required.');
        }

        return user
    }

    private async assertBookingExist(bookingId: string) {
        const booking = await this.prisma.booking.findUnique({ where: {id: bookingId} })
        if(!booking) {
            throw new NotFoundException("Booking not found.")
        }
        return booking
    }

    private async assertBookingInStatus(booking: Booking, ...allowed: BookingStatus[]) {
        if(!allowed.includes(booking.status)) {
            throw new ForbiddenException(`Booking must be in status: ${allowed.join(', ')}`)
        }
    }

    private async assertWorkerIsAvailable(workerId: string) {
        const activeBooking = await this.prisma.booking.findFirst({
            where: {
                workerId,
                status: {
                    in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS]
                }
            }
        })

        if(!activeBooking) {
            throw new ForbiddenException("Worker is currently unavailable")
        }
    }
}
