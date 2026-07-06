import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { PrismaService } from '@/prisma/prisma.service';
import { uploadConfig } from '@/config';

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: {} },
        { provide: uploadConfig.KEY, useValue: { UPLOAD_DIR: 'uploads' } },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws NotFoundException when file does not exist on disk', () => {
    expect(() => service.serveFile('nonexistent/file.jpg')).toThrow(NotFoundException);
  });
});
