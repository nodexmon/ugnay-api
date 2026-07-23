import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { uploadConfig } from '@/config';
import { UploadsAssertions } from './uploads.assertions';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const UPLOAD_DIR = 'uploads';
const adminUser: AuthJwtPayload = { sub: 'admin-id', role: Role.ADMIN };
const workerUser: AuthJwtPayload = { sub: 'worker-user-id', role: Role.WORKER };
const customerUser: AuthJwtPayload = {
  sub: 'customer-user-id',
  role: Role.CUSTOMER,
};

describe('UploadsAssertions', () => {
  let assertions: UploadsAssertions;

  const prisma = {
    verificationDoc: { findFirst: jest.fn() },
    workerCredential: { findFirst: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsAssertions,
        { provide: PrismaService, useValue: prisma },
        { provide: uploadConfig.KEY, useValue: { UPLOAD_DIR } },
      ],
    }).compile();

    assertions = module.get<UploadsAssertions>(UploadsAssertions);
  });

  describe('assertCanReadProtectedFile', () => {
    const verificationPath = 'verification/worker-1/idPhoto-uuid.jpg';
    const credentialsPath = 'credentials/worker-1/license-uuid.pdf';

    it('allows an admin to read a verification file when a DB record exists', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });

      await expect(
        assertions.assertCanReadProtectedFile(adminUser, verificationPath),
      ).resolves.toBeUndefined();
      expect(prisma.workerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows an admin to read a credential file when a DB record exists', async () => {
      prisma.workerCredential.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });

      await expect(
        assertions.assertCanReadProtectedFile(adminUser, credentialsPath),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException for admin when no DB record matches (orphan file)', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue(null);

      await expect(
        assertions.assertCanReadProtectedFile(adminUser, verificationPath),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the owning worker to read their own verification file', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-1' });

      await expect(
        assertions.assertCanReadProtectedFile(workerUser, verificationPath),
      ).resolves.toBeUndefined();
      expect(prisma.workerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: workerUser.sub },
        select: { id: true },
      });
    });

    it('allows the owning worker to read their own credential file', async () => {
      prisma.workerCredential.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-1' });

      await expect(
        assertions.assertCanReadProtectedFile(workerUser, credentialsPath),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for a worker accessing another worker file', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue({
        workerId: 'worker-2',
      });
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-1' });

      await expect(
        assertions.assertCanReadProtectedFile(workerUser, verificationPath),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for a worker without a profile', async () => {
      prisma.workerCredential.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });
      prisma.workerProfile.findUnique.mockResolvedValue(null);

      await expect(
        assertions.assertCanReadProtectedFile(workerUser, credentialsPath),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for worker when no DB record matches (orphan file)', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue(null);

      await expect(
        assertions.assertCanReadProtectedFile(workerUser, verificationPath),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a customer when a record exists', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue({
        workerId: 'worker-1',
      });

      await expect(
        assertions.assertCanReadProtectedFile(customerUser, verificationPath),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown namespace segment', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(adminUser, 'foo/worker-1/x.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for the avatars namespace (not protected)', async () => {
      await expect(
        assertions.assertCanReadProtectedFile(adminUser, 'avatars/uuid.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('looks up the record with the correct stored URL including UPLOAD_DIR prefix', async () => {
      prisma.verificationDoc.findFirst.mockResolvedValue(null);

      await expect(
        assertions.assertCanReadProtectedFile(adminUser, verificationPath),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.verificationDoc.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { idPhotoUrl: `${UPLOAD_DIR}/${verificationPath}` },
            ]),
          }),
        }),
      );
    });
  });
});
