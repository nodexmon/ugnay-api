import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus, VerificationStatus, WorkerStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminService } from '@/modules/admin/admin.service';

describe('AdminService', () => {
  let service: AdminService;
  const tx = {
    verificationDoc: {
      update: jest.fn(),
    },
    workerProfile: {
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
      updateMany: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('suspends the worker profile on a second verification rejection', async () => {
    prisma.verificationDoc.findUnique.mockResolvedValue({
      id: 'doc-id',
      workerId: 'worker-id',
      status: VerificationStatus.PENDING,
    });
    prisma.verificationDoc.count.mockResolvedValue(1);
    tx.workerProfile.update.mockResolvedValue({ id: 'worker-id', status: WorkerStatus.SUSPENDED });

    await service.rejectVerification('doc-id', 'admin-id', 'Documents do not match');

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
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', status: UserStatus.SUSPENDED });

    await expect(service.setUserSuspension('user-id', true)).resolves.toEqual({
      id: 'user-id',
      status: UserStatus.SUSPENDED,
    });
    expect(prisma.workerProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      data: { status: WorkerStatus.SUSPENDED, isOnline: false },
    });
  });
});
