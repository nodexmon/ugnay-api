import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role, StrikeReason, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminService } from '@/modules/admin/admin.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const adminUser = { sub: 'admin-id', role: Role.ADMIN, phone: '' };

describe('AdminService', () => {
  let service: AdminService;
  const tx = {
    verificationDoc: {
      update: jest.fn(),
      count: jest.fn(),
    },
    workerProfile: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    strike: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    noShowReport: {
      update: jest.fn(),
    },
    booking: {
      update: jest.fn(),
    },
  };
  const prisma = {
    verificationDoc: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    workerProfile: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    noShowReport: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { sendToUser: jest.fn().mockResolvedValue(undefined) } },
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
    tx.workerProfile.update.mockResolvedValue({ id: 'worker-id', status: WorkerStatus.SUSPENDED });

    await service.rejectVerification('doc-id', adminUser, 'Documents do not match');

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
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', status: UserStatus.ACTIVE });
    tx.user.update.mockResolvedValue({ id: 'user-id', status: UserStatus.SUSPENDED });

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

    beforeEach(() => {
      prisma.noShowReport = { ...(prisma.noShowReport ?? {}), findUnique: jest.fn() } as typeof prisma.noShowReport;
      prisma.strike = { findUnique: jest.fn() } as unknown as typeof prisma.strike;
      (prisma as Record<string, unknown>).noShowReport = {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      };
      (prisma as Record<string, unknown>).strike = {
        findUnique: jest.fn(),
      };
    });

    it('confirms a no-show: strikes by worker profile id, marks booking NO_SHOW', async () => {
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).noShowReport.findUnique = jest
        .fn()
        .mockResolvedValue(report);
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).strike.findUnique = jest
        .fn()
        .mockResolvedValue(null);
      tx.workerProfile.update.mockResolvedValue({ id: 'worker-profile-id', strikeCount: 1 });

      await service.resolveNoShow('report-id', adminUser, { confirmed: true, notes: 'clear no-show' });

      expect(tx.strike.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: StrikeReason.NO_SHOW, workerId: 'worker-profile-id' }),
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
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).noShowReport.findUnique = jest
        .fn()
        .mockResolvedValue(report);
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).strike.findUnique = jest
        .fn()
        .mockResolvedValue(null);
      tx.workerProfile.update
        .mockResolvedValueOnce({ id: 'worker-profile-id', strikeCount: 3 })
        .mockResolvedValueOnce({ id: 'worker-profile-id', status: WorkerStatus.SUSPENDED });

      await service.resolveNoShow('report-id', adminUser, { confirmed: true });

      expect(tx.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: WorkerStatus.SUSPENDED, isOnline: false } }),
      );
    });

    it('dismisses a no-show without issuing a strike or changing booking status', async () => {
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).noShowReport.findUnique = jest
        .fn()
        .mockResolvedValue(report);

      await service.resolveNoShow('report-id', adminUser, { confirmed: false });

      expect(tx.strike.create).not.toHaveBeenCalled();
      expect(tx.booking.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the report is already resolved', async () => {
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).noShowReport.findUnique = jest
        .fn()
        .mockResolvedValue({ ...report, confirmed: false });

      await expect(
        service.resolveNoShow('report-id', adminUser, { confirmed: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the report does not exist', async () => {
      (prisma as Record<string, unknown & { findUnique: jest.Mock }>).noShowReport.findUnique = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        service.resolveNoShow('report-id', adminUser, { confirmed: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
