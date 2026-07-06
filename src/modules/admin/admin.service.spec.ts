import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
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
        { provide: NotificationsService, useValue: { sendToUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('suspends the worker profile on a second verification rejection', async () => {
    prisma.verificationDoc.findUnique.mockResolvedValue({
      id: 'doc-id',
      workerId: 'worker-id',
      status: VerificationStatus.PENDING,
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

    await expect(service.setUserSuspension(adminUser, 'user-id', true)).resolves.toEqual({
      id: 'user-id',
      status: UserStatus.SUSPENDED,
    });
    expect(tx.workerProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      data: { status: WorkerStatus.SUSPENDED, isOnline: false },
    });
  });
});
