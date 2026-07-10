import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus, WorkerStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkersService } from '@/modules/workers/workers.service';
import { FileStorageService } from '@/modules/workers/file-storage.service';
import { WorkersAssertions } from '@/modules/workers/workers.assertions';
import { UsersAssertions } from '@/modules/users/users.assertions';

describe('WorkersService', () => {
  let service: WorkersService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    workerProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    barangay: {
      count: jest.fn(),
    },
    serviceCategory: {
      count: jest.fn(),
    },
    verificationDoc: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const fileStorage = { resolvePath: jest.fn(), write: jest.fn() };

  const assertions = {
    assertProfileDoesNotExist: jest.fn(),
    assertUnique: jest.fn(),
  };

  const usersAssertions = {
    assertUserIsActive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkersService,
        { provide: PrismaService, useValue: prisma },
        { provide: FileStorageService, useValue: fileStorage },
        { provide: WorkersAssertions, useValue: assertions },
        { provide: UsersAssertions, useValue: usersAssertions },
      ],
    }).compile();

    service = module.get<WorkersService>(WorkersService);
  });

  it('searches verified active workers by default', async () => {
    prisma.workerProfile.findMany.mockResolvedValue([]);

    await service.search({});

    expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: WorkerStatus.VERIFIED,
          isOnline: undefined,
          user: { status: UserStatus.ACTIVE },
        }),
      }),
    );
  });

  it('filters to online workers when availableOnly is true', async () => {
    prisma.workerProfile.findMany.mockResolvedValue([]);

    await service.search({ availableOnly: true });

    expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isOnline: true,
        }),
      }),
    );
  });

  it('rejects duplicate worker categories during profile creation', async () => {
    usersAssertions.assertUserIsActive.mockResolvedValueOnce({
      id: 'user-id',
      status: UserStatus.ACTIVE,
    });
    assertions.assertUnique.mockImplementationOnce(() => {
      throw new BadRequestException('Duplicate categories are not allowed');
    });

    await expect(
      service.createProfile('user-id', {
        firstName: 'Ana',
        lastName: 'Santos',
        baseRate: 500,
        homeBarangayId: '00000000-0000-0000-0000-000000000001',
        categories: [
          { categoryId: '00000000-0000-0000-0000-000000000010' },
          { categoryId: '00000000-0000-0000-0000-000000000010' },
        ],
        serviceAreaBarangayIds: ['00000000-0000-0000-0000-000000000001'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents unverified workers from going online', async () => {
    prisma.workerProfile.findUnique.mockResolvedValue({
      id: 'worker-id',
      status: WorkerStatus.PENDING,
    });

    await expect(
      service.setAvailability('user-id', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
