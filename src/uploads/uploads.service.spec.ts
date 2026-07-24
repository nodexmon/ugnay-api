import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from './uploads.service';
import { UploadsAssertions } from './uploads.assertions';
import { FileCryptoService } from '@/common/services/file-crypto.service';
import { uploadConfig } from '@/config';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('file-bytes')),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

const mockFile = {
  originalname: 'avatar.jpg',
  buffer: Buffer.from('fake-image'),
  mimetype: 'image/jpeg',
};

describe('UploadsService', () => {
  let service: UploadsService;

  const prisma = {
    workerProfile: { update: jest.fn() },
    customerProfile: { update: jest.fn() },
  };

  const assertions = {
    assertCanReadProtectedFile: jest.fn(),
  };

  const crypto = {
    decrypt: jest.fn((data: Buffer) => data),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadsAssertions, useValue: assertions },
        { provide: FileCryptoService, useValue: crypto },
        {
          provide: uploadConfig.KEY,
          useValue: {
            UPLOAD_DIR: 'uploads',
            UPLOAD_ROOT: join(process.cwd(), 'uploads'),
          },
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  describe('uploadAvatar', () => {
    it('updates workerProfile when the role is WORKER', async () => {
      prisma.workerProfile.update.mockResolvedValue({});

      const result = await service.uploadAvatar(
        'user-id',
        Role.WORKER,
        mockFile as any,
      );

      expect(prisma.workerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-id' } }),
      );
      expect(result).toHaveProperty('avatarUrl');
      expect(typeof result.avatarUrl).toBe('string');
    });

    it('updates customerProfile when the role is CUSTOMER', async () => {
      prisma.customerProfile.update.mockResolvedValue({});

      const result = await service.uploadAvatar(
        'user-id',
        Role.CUSTOMER,
        mockFile as any,
      );

      expect(prisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-id' } }),
      );
      expect(result).toHaveProperty('avatarUrl');
    });

    it('derives the extension from the original filename', async () => {
      prisma.workerProfile.update.mockResolvedValue({});
      const pngFile = { ...mockFile, originalname: 'photo.png' };

      const result = await service.uploadAvatar(
        'user-id',
        Role.WORKER,
        pngFile as any,
      );

      expect(result.avatarUrl).toMatch(/\.png$/);
    });
  });

  describe('serveAvatar', () => {
    const fs = require('fs') as {
      existsSync: jest.Mock;
      createReadStream: jest.Mock;
    };

    it('throws NotFoundException when the file does not exist on disk', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => service.serveAvatar('missing.jpg')).toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException on path traversal out of the avatars directory', () => {
      fs.existsSync.mockReturnValue(true);

      expect(() =>
        service.serveAvatar('../verification/worker-1/idPhoto-uuid.jpg'),
      ).toThrow(NotFoundException);
    });

    it('returns a StreamableFile when the file exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });

      const result = service.serveAvatar('avatar.jpg');

      expect(result).toBeDefined();
    });
  });

  describe('serveProtectedFile', () => {
    const fs = require('fs') as {
      existsSync: jest.Mock;
      createReadStream: jest.Mock;
    };

    const worker: AuthJwtPayload = { sub: 'worker-user-id', role: Role.WORKER };

    it('checks ownership with the normalized path before streaming', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });
      assertions.assertCanReadProtectedFile.mockResolvedValue(undefined);

      await service.serveProtectedFile(
        worker,
        'verification/worker-1/../worker-2/idPhoto-uuid.jpg',
      );

      expect(assertions.assertCanReadProtectedFile).toHaveBeenCalledWith(
        worker,
        'verification/worker-2/idPhoto-uuid.jpg',
      );
    });

    it('throws NotFoundException on a path escaping the upload root', async () => {
      await expect(
        service.serveProtectedFile(worker, '../.env'),
      ).rejects.toThrow(NotFoundException);
      expect(assertions.assertCanReadProtectedFile).not.toHaveBeenCalled();
    });

    it('does not stream when the ownership assertion rejects', async () => {
      assertions.assertCanReadProtectedFile.mockRejectedValue(
        new NotFoundException('File not found.'),
      );

      await expect(
        service.serveProtectedFile(worker, 'verification/worker-1/x.jpg'),
      ).rejects.toThrow(NotFoundException);
      const { readFile } = require('fs/promises') as { readFile: jest.Mock };
      expect(readFile).not.toHaveBeenCalled();
    });

    it('returns a StreamableFile when the assertion passes and the file exists', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });
      assertions.assertCanReadProtectedFile.mockResolvedValue(undefined);

      const result = await service.serveProtectedFile(
        worker,
        'verification/worker-1/idPhoto-uuid.jpg',
      );

      expect(result).toBeDefined();
    });
  });
});
