import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CredentialType,
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
    strike: { create: jest.fn() },
    noShowReport: { update: jest.fn() },
    booking: { update: jest.fn() },
  };

  const prisma = {
    verificationDoc: { findMany: jest.fn(), findUnique: jest.fn() },
    workerCredential: { findMany: jest.fn(), findUnique: jest.fn() },
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
    noShowReport: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const assertions = {
    assertWorkerIsUnverified: jest.fn(),
    assertBookingNotAlreadyStruck: jest.fn(),
    assertUserExists: jest.fn(),
    assertWorkerProfileExists: jest.fn(),
    assertBookingExists: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('suspends the worker profile on a second verification rejection', async () => {
    prisma.verificationDoc.findUnique.mockResolvedValue({
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
      prisma.noShowReport.findUnique.mockResolvedValue(report);
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
      prisma.noShowReport.findUnique.mockResolvedValue(report);
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
      prisma.noShowReport.findUnique.mockResolvedValue(report);

      await service.resolveNoShow('report-id', adminUser, { confirmed: false });

      expect(tx.strike.create).not.toHaveBeenCalled();
      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the report is already resolved', async () => {
      prisma.noShowReport.findUnique.mockResolvedValue({
        ...report,
        confirmed: false,
      });

      await expect(
        service.resolveNoShow('report-id', adminUser, { confirmed: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the report does not exist', async () => {
      prisma.noShowReport.findUnique.mockResolvedValue(null);

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

      const result = await service.findPendingCredentials();

      expect(result).toEqual([pendingCredential]);
      expect(prisma.workerCredential.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: VerificationStatus.PENDING } }),
      );
    });

    it('approves a credential and updates its status to APPROVED', async () => {
      prisma.workerCredential.findUnique.mockResolvedValue(pendingCredential);
      const approved = { ...pendingCredential, status: VerificationStatus.APPROVED };
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
      prisma.workerCredential.findUnique.mockResolvedValue(pendingCredential);
      const rejected = { ...pendingCredential, status: VerificationStatus.REJECTED };
      tx.workerCredential.update.mockResolvedValue(rejected);

      await service.rejectCredential('cred-id', adminUser, 'Certificate expired');

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
      prisma.workerCredential.findUnique.mockResolvedValue(null);

      await expect(
        service.approveCredential('cred-id', adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the credential was already reviewed', async () => {
      prisma.workerCredential.findUnique.mockResolvedValue({
        ...pendingCredential,
        status: VerificationStatus.APPROVED,
      });

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
  });
});
