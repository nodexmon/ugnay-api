import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from './uploads.service';
import { uploadConfig } from '@/config';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: uploadConfig.KEY, useValue: { UPLOAD_DIR: 'uploads' } },
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

  describe('serveFile', () => {
    const fs = require('fs') as {
      existsSync: jest.Mock;
      createReadStream: jest.Mock;
    };

    it('throws NotFoundException when the file does not exist on disk', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => service.serveFile('avatars/missing.jpg')).toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException on path traversal attempt', () => {
      fs.existsSync.mockReturnValue(true);

      expect(() => service.serveFile('../../etc/passwd')).toThrow(
        NotFoundException,
      );
    });

    it('returns a StreamableFile when the file exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });

      const result = service.serveFile('avatars/avatar.jpg');

      expect(result).toBeDefined();
    });
  });
});
