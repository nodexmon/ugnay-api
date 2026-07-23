import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsAssertions } from './uploads.assertions';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const adminUser: AuthJwtPayload = { sub: 'admin-id', role: Role.ADMIN };
const workerUser: AuthJwtPayload = { sub: 'worker-user-id', role: Role.WORKER };
const customerUser: AuthJwtPayload = {
  sub: 'customer-user-id',
  role: Role.CUSTOMER,
};

describe('UploadsAssertions', () => {
  let assertions: UploadsAssertions;

  const prisma = {
    workerProfile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    assertions = module.get<UploadsAssertions>(UploadsAssertions);
  });

  describe('assertCanReadProtectedFile', () => {
    it('allows an admin to read a verification file', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(
          adminUser,
          'verification/worker-1/idPhoto-uuid.jpg',
        ),
      ).resolves.toBeUndefined();
      expect(prisma.workerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows an admin to read a credential file', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(
          adminUser,
          'credentials/worker-1/license-uuid.pdf',
        ),
      ).resolves.toBeUndefined();
    });

    it('allows the owning worker to read their own file', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-1' });

      await expect(
        assertions.assertCanReadProtectedFile(
          workerUser,
          'verification/worker-1/selfie-uuid.jpg',
        ),
      ).resolves.toBeUndefined();
      expect(prisma.workerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: workerUser.sub },
        select: { id: true },
      });
    });

    it('throws ForbiddenException for a non-owning worker', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-2' });

      await expect(
        assertions.assertCanReadProtectedFile(
          workerUser,
          'verification/worker-1/idPhoto-uuid.jpg',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for a worker without a profile', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(
        assertions.assertCanReadProtectedFile(
          workerUser,
          'credentials/worker-1/license-uuid.pdf',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for a customer', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(
          customerUser,
          'verification/worker-1/idPhoto-uuid.jpg',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown first segment', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(adminUser, 'foo/worker-1/x.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an avatars path (not a protected namespace)', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(adminUser, 'avatars/uuid.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the worker segment is missing', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(adminUser, 'verification'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
