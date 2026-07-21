import { ConflictException, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CredentialType,
  NoShowReportType,
  Role,
  StrikeReason,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminService } from '@/modules/admin/admin.service';
import { AdminAssertions } from '@/modules/admin/admin.assertions';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { BarangaySyncService } from '@/modules/barangays/barangay-sync.service';

const adminUser = { sub: 'admin-id', role: Role.ADMIN, phone: '' };

describe('AdminService', () => {
  let service: AdminService;

  const tx = {
    verificationDoc: { update: jest.fn(), count: jest.fn() },
    workerCredential: { update: jest.fn() },
    workerProfile: { update: jest.fn(), updateMany: jest.fn() },
    user: { update: jest.fn() },
    strike: { create: jest.fn(), findUnique: jest.fn() },
    noShowReport: { update: jest.fn() },
    booking: { update: jest.fn() },
    review: { delete: jest.fn(), aggregate: jest.fn() },
  };

  const prisma = {
    verificationDoc: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    workerCredential: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    workerProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    booking: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    noShowReport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const assertions = {
    assertWorkerIsUnverified: jest.fn(),
    assertUserExists: jest.fn(),
    findWorkerProfile: jest.fn(),
    findSuspendedWorker: jest.fn(),
    assertBookingExists: jest.fn(),
    findPendingVerification: jest.fn(),
    findPendingCredential: jest.fn(),
    findPendingNoShowReport: jest.fn(),
    findPendingCustomerNoShowReport: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callbackOrArray: ((transaction: typeof tx) => unknown) | unknown[]) =>
        Array.isArray(callbackOrArray)
          ? Promise.all(callbackOrArray)
          : callbackOrArray(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { sendToUser: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: AdminAssertions, useValue: assertions },
        {
          provide: BarangaySyncService,
          useValue: { syncBarangays: jest.fn() },
        },
        { provide: Logger, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('suspends the worker profile on a second verification rejection', async () => {
    assertions.findPendingVerification.mockResolvedValue({
      id: 'doc-id',
      workerId: 'worker-id',
      status: VerificationStatus.PENDING,
      worker: { userId: 'user-id' },
    });
    tx.verificationDoc.count.mockResolvedValue(1);
    tx.workerProfile.update.mockResolvedValue({
      id: 'worker-id',
      status: WorkerStatus.SUSPENDED,
    });

    await service.rejectVerification(
      'doc-id',
      adminUser,
      'Documents do not match',
    );

    expect(tx.workerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkerStatus.SUSPENDED,
          isOnline: false,
        }),
      }),
    );
  });

  it('can suspend a user account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.ACTIVE,
    });
    tx.user.update.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.SUSPENDED,
    });

    await expect(service.setUserSuspension('user-id', true)).resolves.toEqual({
      id: 'user-id',
      status: UserStatus.SUSPENDED,
    });
    expect(tx.workerProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      data: { status: WorkerStatus.SUSPENDED, isOnline: false },
    });
  });

  it('does not change WorkerProfile status when unsuspending a user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.SUSPENDED,
    });
    tx.user.update.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.ACTIVE,
    });

    await service.setUserSuspension('user-id', false);

    expect(tx.workerProfile.updateMany).not.toHaveBeenCalled();
  });

  describe('reinstateWorker', () => {
    const suspendedWorker = {
      id: 'worker-profile-id',
      userId: 'user-id',
      status: WorkerStatus.SUSPENDED,
    };

    it('resets strikeCount and restores statuses for a suspended worker', async () => {
      assertions.findSuspendedWorker.mockResolvedValue(suspendedWorker);
      tx.user.update.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVE,
      });
      tx.workerProfile.update.mockResolvedValue({
        id: 'worker-profile-id',
        status: WorkerStatus.VERIFIED,
        strikeCount: 0,
      });

      await service.reinstateWorker(
        'worker-profile-id',
        { auditNote: 'Reviewed and cleared' },
        adminUser,
      );

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { status: UserStatus.ACTIVE },
      });
      expect(tx.workerProfile.update).toHaveBeenCalledWith({
        where: { id: 'worker-profile-id' },
        data: { status: WorkerStatus.VERIFIED, strikeCount: 0 },
      });
    });

    it('throws NotFoundException when worker is not suspended', async () => {
      assertions.findSuspendedWorker.mockRejectedValue(
        new NotFoundException('Suspended worker not found.'),
      );

      await expect(
        service.reinstateWorker(
          'worker-profile-id',
          { auditNote: 'note' },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveNoShow', () => {
    const report = {
      id: 'report-id',
      bookingId: 'booking-id',
      confirmed: null,
      booking: {
        id: 'booking-id',
        workerId: 'worker-profile-id',
        worker: { userId: 'worker-user-id' },
      },
    };

    it('confirms a no-show: strikes by worker profile id, marks booking NO_SHOW', async () => {
      assertions.findPendingNoShowReport.mockResolvedValue(report);
      tx.workerProfile.update.mockResolvedValue({
        id: 'worker-profile-id',
        strikeCount: 1,
      });

      await service.resolveNoShow('report-id', adminUser, {
        confirmed: true,
        notes: 'clear no-show',
      });

      expect(tx.strike.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: StrikeReason.NO_SHOW,
            workerId: 'worker-profile-id',
          }),
        }),
      );
      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'worker-profile-id' } }),
      );
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.NO_SHOW } }),
      );
    });

    it('suspends the worker when confirming a no-show pushes strike count to 3', async () => {
      assertions.findPendingNoShowReport.mockResolvedValue(report);
      tx.workerProfile.update
        .mockResolvedValueOnce({ id: 'worker-profile-id', strikeCount: 3 })
        .mockResolvedValueOnce({
          id: 'worker-profile-id',
          status: WorkerStatus.SUSPENDED,
        });

      await service.resolveNoShow('report-id', adminUser, { confirmed: true });

      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: WorkerStatus.SUSPENDED, isOnline: false },
        }),
      );
    });

    it('dismisses a no-show without issuing a strike or changing booking status', async () => {
      assertions.findPendingNoShowReport.mockResolvedValue(report);

      await service.resolveNoShow('report-id', adminUser, { confirmed: false });

      expect(tx.strike.create).not.toHaveBeenCalled();
      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the report is already resolved', async () => {
      assertions.findPendingNoShowReport.mockRejectedValue(
        new ConflictException('This report has already been resolved.'),
      );

      await expect(
        service.resolveNoShow('report-id', adminUser, { confirmed: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the report does not exist', async () => {
      assertions.findPendingNoShowReport.mockRejectedValue(
        new NotFoundException('No-show report not found.'),
      );

      await expect(
        service.resolveNoShow('report-id', adminUser, { confirmed: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('credential review', () => {
    const pendingCredential = {
      id: 'cred-id',
      workerId: 'worker-id',
      type: CredentialType.LICENSE,
      status: VerificationStatus.PENDING,
      worker: { userId: 'user-id' },
    };

    it('returns all pending credentials with worker details', async () => {
      prisma.workerCredential.findMany.mockResolvedValue([pendingCredential]);
      prisma.workerCredential.count.mockResolvedValue(1);

      const result = await service.findPendingCredentials({
        skip: 0,
        take: 10,
      });

      expect(result).toEqual({
        items: [pendingCredential],
        total: 1,
        skip: 0,
        take: 10,
      });
      expect(prisma.workerCredential.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: VerificationStatus.PENDING },
        }),
      );
    });

    it('approves a credential and updates its status to APPROVED', async () => {
      assertions.findPendingCredential.mockResolvedValue(pendingCredential);
      const approved = {
        ...pendingCredential,
        status: VerificationStatus.APPROVED,
      };
      tx.workerCredential.update.mockResolvedValue(approved);

      const result = await service.approveCredential('cred-id', adminUser);

      expect(result).toEqual(approved);
      expect(tx.workerCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cred-id' },
          data: expect.objectContaining({
            status: VerificationStatus.APPROVED,
            reviewedBy: adminUser.sub,
          }),
        }),
      );
    });

    it('rejects a credential and stores the rejection reason', async () => {
      assertions.findPendingCredential.mockResolvedValue(pendingCredential);
      const rejected = {
        ...pendingCredential,
        status: VerificationStatus.REJECTED,
      };
      tx.workerCredential.update.mockResolvedValue(rejected);

      await service.rejectCredential(
        'cred-id',
        adminUser,
        'Certificate expired',
      );

      expect(tx.workerCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: VerificationStatus.REJECTED,
            rejectionReason: 'Certificate expired',
          }),
        }),
      );
    });

    it('throws NotFoundException when the credential does not exist', async () => {
      assertions.findPendingCredential.mockRejectedValueOnce(
        new NotFoundException('Credential not found.'),
      );

      await expect(
        service.approveCredential('cred-id', adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the credential was already reviewed', async () => {
      assertions.findPendingCredential.mockRejectedValueOnce(
        new ConflictException('Credential has already been reviewed.'),
      );

      await expect(
        service.approveCredential('cred-id', adminUser),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('admin listings', () => {
    it('findUsers returns paginated users matching optional filters', async () => {
      const users = [{ id: 'u1', phone: '+63911', role: Role.CUSTOMER }];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findUsers({ skip: 0, take: 10 });

      expect(result).toEqual({ items: users, total: 1, skip: 0, take: 10 });
    });

    it('findWorkers returns paginated workers with optional status filter', async () => {
      const workers = [{ id: 'wp1', firstName: 'Juan' }];
      prisma.workerProfile.findMany.mockResolvedValue(workers);
      prisma.workerProfile.count.mockResolvedValue(1);

      const result = await service.findWorkers({
        skip: 0,
        take: 10,
        status: WorkerStatus.VERIFIED,
      });

      expect(result).toEqual({ items: workers, total: 1, skip: 0, take: 10 });
      expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: WorkerStatus.VERIFIED } }),
      );
    });

    it('findBookings returns paginated bookings with optional status filter', async () => {
      const bookings = [{ id: 'b1', status: BookingStatus.PENDING }];
      prisma.booking.findMany.mockResolvedValue(bookings);
      prisma.booking.count.mockResolvedValue(5);

      const result = await service.findBookings({
        skip: 0,
        take: 10,
        status: BookingStatus.PENDING,
      });

      expect(result).toEqual({ items: bookings, total: 5, skip: 0, take: 10 });
    });

    it('findPendingNoShows filters by WORKER report type', async () => {
      prisma.noShowReport.findMany.mockResolvedValue([]);
      prisma.noShowReport.count.mockResolvedValue(0);

      await service.findPendingNoShows({ skip: 0, take: 10 });

      expect(prisma.noShowReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportType: NoShowReportType.WORKER,
          }),
        }),
      );
    });
  });

  // ─── findPendingCustomerNoShows ───────────────────────────────────────────────

  describe('findPendingCustomerNoShows', () => {
    it('returns paginated customer no-show reports', async () => {
      const reports = [
        { id: 'report-id', reportType: NoShowReportType.CUSTOMER },
      ];
      prisma.noShowReport.findMany.mockResolvedValue(reports);
      prisma.noShowReport.count.mockResolvedValue(1);

      const result = await service.findPendingCustomerNoShows({
        skip: 0,
        take: 10,
      });

      expect(result).toEqual({ items: reports, total: 1, skip: 0, take: 10 });
      expect(prisma.noShowReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportType: NoShowReportType.CUSTOMER,
            confirmed: null,
          }),
        }),
      );
    });
  });

  // ─── resolveCustomerNoShow ────────────────────────────────────────────────────

  describe('resolveCustomerNoShow', () => {
    const customerReport = {
      id: 'report-id',
      bookingId: 'booking-id',
      confirmed: null,
      booking: { id: 'booking-id', customerId: 'customer-profile-id' },
    };

    it('confirms a customer no-show and marks booking as CUSTOMER_NO_SHOW', async () => {
      assertions.findPendingCustomerNoShowReport.mockResolvedValue(
        customerReport,
      );
      tx.noShowReport.update.mockResolvedValue({ confirmed: true });
      tx.booking.update.mockResolvedValue({
        id: 'booking-id',
        status: BookingStatus.CUSTOMER_NO_SHOW,
      });

      const result = await service.resolveCustomerNoShow(
        'report-id',
        adminUser,
        { confirmed: true },
      );

      expect(result).toEqual({ resolved: true, confirmed: true });
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: BookingStatus.CUSTOMER_NO_SHOW },
        }),
      );
    });

    it('dismisses a customer no-show without changing booking status', async () => {
      assertions.findPendingCustomerNoShowReport.mockResolvedValue(
        customerReport,
      );

      await service.resolveCustomerNoShow('report-id', adminUser, {
        confirmed: false,
      });

      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when report does not exist', async () => {
      assertions.findPendingCustomerNoShowReport.mockRejectedValue(
        new NotFoundException('No-show report not found.'),
      );

      await expect(
        service.resolveCustomerNoShow('report-id', adminUser, {
          confirmed: true,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── review moderation ────────────────────────────────────────────────────────

  describe('findAllReviews', () => {
    it('returns paginated reviews with optional workerId filter', async () => {
      const reviews = [{ id: 'review-id', rating: 5 }];
      prisma.review.findMany.mockResolvedValue(reviews);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.findAllReviews({
        skip: 0,
        take: 10,
        workerId: 'worker-id',
      });

      expect(result).toEqual({ items: reviews, total: 1, skip: 0, take: 10 });
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workerId: 'worker-id' },
        }),
      );
    });

    it('returns all reviews when no workerId is provided', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);

      await service.findAllReviews({ skip: 0, take: 10 });

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('deleteReview', () => {
    const review = {
      id: 'review-id',
      workerId: 'worker-profile-id',
      rating: 4,
    };

    it('deletes the review and recalculates the worker rating', async () => {
      prisma.review.findUnique.mockResolvedValue(review);
      tx.review.aggregate.mockResolvedValue({
        _avg: { rating: 3.5 },
        _count: 2,
      });
      tx.workerProfile.update.mockResolvedValue({ id: 'worker-profile-id' });

      const result = await service.deleteReview('review-id');

      expect(result).toEqual({ deleted: true });
      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { averageRating: 3.5, totalReviews: 2 },
        }),
      );
    });

    it('sets averageRating to 0 when no reviews remain after deletion', async () => {
      prisma.review.findUnique.mockResolvedValue(review);
      tx.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: 0,
      });
      tx.workerProfile.update.mockResolvedValue({ id: 'worker-profile-id' });

      await service.deleteReview('review-id');

      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { averageRating: 0, totalReviews: 0 },
        }),
      );
    });

    it('throws NotFoundException when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.deleteReview('review-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
