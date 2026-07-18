import { Test, TestingModule } from '@nestjs/testing';
import { FileStorageService } from './file-storage.service';
import { uploadConfig } from '@/config';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const mockUploadConfig = { UPLOAD_DIR: 'uploads' };

const mockFile = {
  originalname: 'cert.pdf',
  buffer: Buffer.from('fake-pdf'),
  mimetype: 'application/pdf',
};

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: uploadConfig.KEY, useValue: mockUploadConfig },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
  });

  describe('resolvePath', () => {
    it('returns relative, absolute, and dir paths for a given file', () => {
      const paths = service.resolvePath(
        'worker-id',
        'idPhoto',
        mockFile as any,
      );

      expect(paths.relative).toMatch(/uploads/);
      expect(paths.relative).toMatch(/worker-id/);
      expect(paths.relative).toMatch(/idPhoto-/);
      expect(paths.relative).toMatch(/\.pdf$/);
      expect(paths.absolute).toBeDefined();
      expect(paths.dir).toBeDefined();
    });

    it('uses the provided subdir', () => {
      const paths = service.resolvePath(
        'worker-id',
        'cert',
        mockFile as any,
        'credentials',
      );

      expect(paths.relative).toMatch(/credentials/);
    });

    it('defaults to verification subdir', () => {
      const paths = service.resolvePath('worker-id', 'selfie', mockFile as any);

      expect(paths.relative).toMatch(/verification/);
    });

    it('uses forward slashes in the relative path', () => {
      const paths = service.resolvePath(
        'worker-id',
        'idPhoto',
        mockFile as any,
      );

      expect(paths.relative).not.toContain('\\');
    });
  });

  describe('write', () => {
    it('calls mkdir and writeFile with the correct arguments', async () => {
      const { mkdir, writeFile } = require('fs/promises') as {
        mkdir: jest.Mock;
        writeFile: jest.Mock;
      };

      const paths = {
        relative: 'uploads/verification/worker-id/idPhoto-uuid.jpg',
        absolute: '/abs/path/idPhoto-uuid.jpg',
        dir: '/abs/path',
      };

      await service.write(paths, mockFile as any);

      expect(mkdir).toHaveBeenCalledWith(paths.dir, { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(paths.absolute, mockFile.buffer);
    });
  });
});
