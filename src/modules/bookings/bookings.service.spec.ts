import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CancellationActor,
  Role,
  StrikeReason,
  UserStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsService } from './bookings.service';
import { BookingsAssertions } from './bookings.assertions';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { UsersAssertions } from '@/modules/users/users.assertions';

const customerUser = { id: 'user-id', status: UserStatus.ACTIVE };
const workerUser = { id: 'worker-user-id', status: UserStatus.ACTIVE };
const customerJwt = { sub: 'user-id', role: Role.CUSTOMER, phone: '' };
const workerJwt = { sub: 'worker-user-id', role: Role.WORKER, phone: '' };

const pendingBooking = {
  id: 'booking-id',
  status: BookingStatus.PENDING,
  customerId: 'customer-profile-id',
  workerId: 'worker-profile-id',
};

describe('BookingsService', () => {
  let service: BookingsService;

  const tx = {
    booking: { update: jest.fn() },
    workerProfile: { update: jest.fn() },
    strike: { create: jest.fn() },
  };

  const prisma = {
    customerProfile: { findUnique: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
    booking: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    noShowReport: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const assertions = {
    assertOwnership: jest.fn(),
    assertBookingExists: jest.fn(),
    assertBookingInStatus: jest.fn(),
    assertNoReportExists: jest.fn(),
    assertWorkerIsAvailable: jest.fn(),
  };

  const usersAssertions = {
    assertUserIsActive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );
    assertions.assertBookingExists.mockResolvedValue(pendingBooking);
    usersAssertions.assertUserIsActive.mockResolvedValue(customerUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsAssertions, useValue: assertions },
        { provide: UsersAssertions, useValue: usersAssertions },
        {
          provide: NotificationsService,
          useValue: { sendToUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      workerId: 'worker-profile-id',
      categoryId: 'category-id',
      barangayId: 'barangay-id',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      description: 'Fix tap',
      timeWindow: 'MORNING' as never,
      bookingType: 'ON_SITE' as never,
    };

    it('creates a booking and notifies the worker', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      prisma.booking.create.mockResolvedValue({ id: 'booking-id', ...dto });

      const result = await service.create(customerJwt, dto);

      expect(result).toMatchObject({ id: 'booking-id' });
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.PENDING }),
        }),
      );
    });

    it('throws ForbiddenException when customer profile is missing', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(service.create(customerJwt, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when the worker already has an active booking', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      assertions.assertWorkerIsAvailable.mockRejectedValueOnce(
        new ForbiddenException('Worker is currently unavailable.'),
      );

      await expect(service.create(customerJwt, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when scheduledDate is more than 7 days away', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });

      const farDto = {
        ...dto,
        scheduledDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      };
      await expect(service.create(customerJwt, farDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ─── accept ──────────────────────────────────────────────────────────────────

  describe('accept', () => {
    it('transitions booking to ACCEPTED', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });

      await service.accept('booking-id', workerJwt);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.ACCEPTED }),
        }),
      );
    });

    it('throws ForbiddenException when booking is not PENDING', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException('Booking must be in status: PENDING');
      });

      await expect(
        service.accept('booking-id', workerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when worker does not own the booking', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });
      assertions.assertOwnership.mockImplementationOnce(() => {
        throw new ForbiddenException('Insufficient permissions.');
      });

      await expect(
        service.accept('booking-id', workerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── reject ──────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('transitions booking to REJECTED', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });

      await service.reject('booking-id', workerJwt);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.REJECTED }),
        }),
      );
    });
  });

  // ─── start ───────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('transitions booking to IN_PROGRESS', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });

      await service.start('booking-id', workerJwt);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.IN_PROGRESS }),
        }),
      );
    });

    it('throws ForbiddenException when booking is not ACCEPTED', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException('Booking must be in status: ACCEPTED');
      });

      await expect(
        service.start('booking-id', workerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── complete ─────────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('transitions booking to COMPLETED', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.IN_PROGRESS,
      });
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });

      await service.complete('booking-id', workerJwt);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
        }),
      );
    });

    it('throws ForbiddenException when booking is not IN_PROGRESS', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException('Booking must be in status: IN_PROGRESS');
      });

      await expect(
        service.complete('booking-id', workerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    const cancelDto = { cancellationReason: 'Changed mind' };

    it('lets a customer cancel a PENDING booking without a strike penalty', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });

      await service.cancel('booking-id', customerJwt, cancelDto);

      expect(tx.workerProfile.update).not.toHaveBeenCalled();
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            cancellationActor: CancellationActor.CUSTOMER,
          }),
        }),
      );
    });

    it('issues a POST_ACCEPT_CANCELLATION strike when a worker cancels', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });
      tx.workerProfile.update.mockResolvedValue({
        id: 'worker-profile-id',
        strikeCount: 1,
      });

      await service.cancel('booking-id', workerJwt, cancelDto);

      expect(tx.strike.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: StrikeReason.POST_ACCEPT_CANCELLATION,
            issuedBy: 'SYSTEM',
          }),
        }),
      );
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancellationActor: CancellationActor.WORKER,
          }),
        }),
      );
    });

    it('suspends a worker whose third strike comes from a cancellation', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });
      tx.workerProfile.update
        .mockResolvedValueOnce({ id: 'worker-profile-id', strikeCount: 3 })
        .mockResolvedValueOnce({
          id: 'worker-profile-id',
          status: WorkerStatus.SUSPENDED,
        });

      await service.cancel('booking-id', workerJwt, cancelDto);

      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: WorkerStatus.SUSPENDED,
            isOnline: false,
          }),
        }),
      );
    });

    it('throws ForbiddenException when caller is not CUSTOMER or WORKER', async () => {
      await expect(
        service.cancel(
          'booking-id',
          { ...customerJwt, role: Role.ADMIN },
          cancelDto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when a customer tries to cancel a post-accept booking', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException('Booking must be in status: PENDING');
      });

      await expect(
        service.cancel('booking-id', customerJwt, cancelDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when a worker tries to cancel a PENDING booking', async () => {
      usersAssertions.assertUserIsActive.mockResolvedValue(workerUser);
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-profile-id',
      });
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException(
          'Booking must be in status: ACCEPTED, IN_PROGRESS',
        );
      });

      await expect(
        service.cancel('booking-id', workerJwt, cancelDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── reportNoShow ─────────────────────────────────────────────────────────────

  describe('reportNoShow', () => {
    it('creates a no-show report', async () => {
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      prisma.noShowReport.create.mockResolvedValue({ id: 'report-id' });

      const result = await service.reportNoShow(
        'booking-id',
        customerJwt,
        'Worker did not arrive',
      );

      expect(result).toMatchObject({ id: 'report-id' });
    });

    it('throws ForbiddenException when a report already exists for the booking', async () => {
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      assertions.assertNoReportExists.mockRejectedValueOnce(
        new ForbiddenException(
          'A no-show report already exists for this booking.',
        ),
      );

      await expect(
        service.reportNoShow('booking-id', customerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when the customer does not own the booking', async () => {
      assertions.assertBookingExists.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.ACCEPTED,
      });
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'customer-profile-id',
      });
      assertions.assertOwnership.mockImplementationOnce(() => {
        throw new ForbiddenException('Insufficient permissions.');
      });

      await expect(
        service.reportNoShow('booking-id', customerJwt),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws ForbiddenException when booking is not PENDING', async () => {
      assertions.assertBookingInStatus.mockImplementationOnce(() => {
        throw new ForbiddenException('Booking must be in status: PENDING');
      });

      await expect(
        service.update('booking-id', customerJwt, { description: 'updated' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
