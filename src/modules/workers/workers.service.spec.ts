import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  CredentialType,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkersService } from '@/modules/workers/workers.service';
import { FileStorageService } from '@/modules/workers/file-storage.service';
import { WorkersAssertions } from '@/modules/workers/workers.assertions';
import { UsersAssertions } from '@/modules/users/users.assertions';

describe('WorkersService', () => {
  let service: WorkersService;

  const tx = {
    workerProfile: { update: jest.fn() },
    verificationDoc: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    workerCredential: { count: jest.fn(), create: jest.fn() },
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    workerProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
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
    workerCredential: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    strike: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const fileStorage = { resolvePath: jest.fn(), write: jest.fn() };

  const assertions = {
    assertProfileDoesNotExist: jest.fn(),
    assertUnique: jest.fn(),
    assertWorkerCanGoOnline: jest.fn(),
    assertWorkerCanSubmitVerification: jest.fn(),
    assertNoPendingVerification: jest.fn(),
    assertVerificationReapplicationAllowed: jest.fn(),
    assertActiveCredentialCountUnder: jest.fn(),
    assertBarangaysAreValid: jest.fn(),
    assertCategoriesAreValid: jest.fn(),
  };

  const usersAssertions = {
    findActiveUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (arg: ((transaction: typeof tx) => unknown) | Promise<unknown>[]) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg(tx);
      },
    );

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
    prisma.workerProfile.count.mockResolvedValue(0);

    const result = await service.search({});

    expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: WorkerStatus.VERIFIED,
          isOnline: undefined,
          user: { status: UserStatus.ACTIVE },
        }),
      }),
    );
    expect(result).toMatchObject({ items: [], total: 0 });
  });

  it('filters to online workers when availableOnly is true', async () => {
    prisma.workerProfile.findMany.mockResolvedValue([]);
    prisma.workerProfile.count.mockResolvedValue(0);

    await service.search({ availableOnly: true });

    expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isOnline: true,
        }),
      }),
    );
  });

  it('excludes workers with PENDING bookings from search results', async () => {
    prisma.workerProfile.findMany.mockResolvedValue([]);
    prisma.workerProfile.count.mockResolvedValue(0);

    await service.search({});

    expect(prisma.workerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookings: {
            none: {
              status: {
                in: expect.arrayContaining([
                  BookingStatus.PENDING,
                  BookingStatus.ACCEPTED,
                  BookingStatus.IN_PROGRESS,
                ]),
              },
            },
          },
        }),
      }),
    );
  });

  it('masks averageRating as null when worker has fewer than 3 reviews', async () => {
    const worker = { id: 'w1', totalReviews: 2, averageRating: 4.5 };
    prisma.workerProfile.findMany.mockResolvedValue([worker]);
    prisma.workerProfile.count.mockResolvedValue(1);

    const result = await service.search({});

    expect(result.items[0].averageRating).toBeNull();
  });

  it('returns raw averageRating when worker has 3 or more reviews', async () => {
    const worker = { id: 'w1', totalReviews: 3, averageRating: 4.5 };
    prisma.workerProfile.findMany.mockResolvedValue([worker]);
    prisma.workerProfile.count.mockResolvedValue(1);

    const result = await service.search({});

    expect(result.items[0].averageRating).toBe(4.5);
  });

  it('rejects duplicate worker categories during profile creation', async () => {
    usersAssertions.findActiveUser.mockResolvedValueOnce({
      id: 'user-id',
      status: UserStatus.ACTIVE,
    });
    assertions.assertCategoriesAreValid.mockRejectedValueOnce(
      new BadRequestException('Duplicate categories are not allowed.'),
    );

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
    assertions.assertWorkerCanGoOnline.mockImplementationOnce(() => {
      throw new ForbiddenException(
        'Worker must be verified before going online.',
      );
    });

    await expect(
      service.setAvailability('user-id', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('uploadCredential', () => {
    const file = {
      originalname: 'license.pdf',
      mimetype: 'application/pdf',
      size: 100000,
      buffer: Buffer.from(''),
    };
    const credentialPath = {
      relative: 'uploads/credentials/worker-id/license-uuid.pdf',
      absolute: '/abs/uploads/credentials/worker-id/license-uuid.pdf',
      dir: '/abs/uploads/credentials/worker-id',
    };

    beforeEach(() => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        id: 'worker-id',
        status: WorkerStatus.VERIFIED,
      });
      fileStorage.resolvePath.mockReturnValue(credentialPath);
      fileStorage.write.mockResolvedValue(undefined);
    });

    it('creates a credential record and writes the file', async () => {
      const created = {
        id: 'cred-id',
        type: CredentialType.LICENSE,
        status: VerificationStatus.PENDING,
      };
      tx.workerCredential.create.mockResolvedValue(created);

      const result = await service.uploadCredential(
        'user-id',
        CredentialType.LICENSE,
        file,
      );

      expect(result).toBe(created);
      expect(tx.workerCredential.create).toHaveBeenCalledWith({
        data: {
          workerId: 'worker-id',
          type: CredentialType.LICENSE,
          fileUrl: credentialPath.relative,
        },
      });
      expect(fileStorage.write).toHaveBeenCalledWith(credentialPath, file);
    });

    it('resolves the file path in the credentials subdirectory', async () => {
      tx.workerCredential.create.mockResolvedValue({});

      await service.uploadCredential(
        'user-id',
        CredentialType.CERTIFICATION,
        file,
      );

      expect(fileStorage.resolvePath).toHaveBeenCalledWith(
        'worker-id',
        'certification',
        file,
        'credentials',
      );
    });

    it('throws BadRequestException when the worker already has 5 active credentials', async () => {
      assertions.assertActiveCredentialCountUnder.mockRejectedValueOnce(
        new BadRequestException('Maximum of 5 active credentials allowed.'),
      );

      await expect(
        service.uploadCredential('user-id', CredentialType.LICENSE, file),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.workerCredential.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the worker has no profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadCredential('user-id', CredentialType.LICENSE, file),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── findOwnVerification ─────────────────────────────────────────────────────

  describe('findOwnVerification', () => {
    it('returns the latest verification doc for the worker', async () => {
      const workerProfile = { id: 'worker-profile-id' };
      const verificationDoc = {
        id: 'doc-id',
        status: VerificationStatus.PENDING,
      };
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      prisma.verificationDoc.findFirst.mockResolvedValue(verificationDoc);

      const result = await service.findOwnVerification('user-id');

      expect(result).toEqual(verificationDoc);
      expect(prisma.verificationDoc.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workerId: 'worker-profile-id' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('throws NotFoundException when the worker has no profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findOwnVerification('user-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── findOwnCredentials ──────────────────────────────────────────────────────

  describe('findOwnCredentials', () => {
    it('returns the credential list ordered by newest first', async () => {
      const workerProfile = { id: 'worker-profile-id' };
      const credentials = [
        { id: 'cred-2', status: 'REJECTED', rejectionReason: 'Blurry scan.' },
        { id: 'cred-1', status: 'APPROVED', rejectionReason: null },
      ];
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      prisma.workerCredential.findMany.mockResolvedValue(credentials);

      const result = await service.findOwnCredentials('user-id');

      expect(result).toEqual(credentials);
      expect(prisma.workerCredential.findMany).toHaveBeenCalledWith({
        where: { workerId: 'worker-profile-id' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws NotFoundException when the worker has no profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findOwnCredentials('user-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── findOwnStrikes ──────────────────────────────────────────────────────────

  describe('findOwnStrikes', () => {
    it('returns the strike list and total count', async () => {
      const workerProfile = { id: 'worker-profile-id', strikeCount: 1 };
      const strikes = [{ id: 'strike-id', reason: 'NO_SHOW' }];
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      prisma.strike.findMany.mockResolvedValue(strikes);

      const result = await service.findOwnStrikes('user-id');

      expect(result).toEqual({ items: strikes, total: 1 });
    });

    it('throws NotFoundException when the worker has no profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOwnStrikes('user-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
