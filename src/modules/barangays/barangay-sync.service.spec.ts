import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';
import { BarangaySyncService } from './barangay-sync.service';
import { psgcConfig } from '@/config/psgc.config';

const mockPsgcConfig = {
  apiUrl: 'https://psgc.gitlab.io/api',
  calapanCityCode: '175203000',
};

const psgcBarangays = [
  { code: '175203001', name: 'Barangay 1' },
  { code: '175203002', name: 'Barangay 2' },
];

describe('BarangaySyncService', () => {
  let service: BarangaySyncService;

  const prisma = {
    barangay: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const http = {
    get: jest.fn(),
  };

  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarangaySyncService,
        { provide: psgcConfig.KEY, useValue: mockPsgcConfig },
        { provide: HttpService, useValue: http },
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get<BarangaySyncService>(BarangaySyncService);
  });

  describe('syncBarangays', () => {
    it('creates barangays that do not yet exist', async () => {
      http.get.mockReturnValue(of({ data: psgcBarangays }));
      prisma.barangay.findFirst.mockResolvedValue(null);
      prisma.barangay.create.mockResolvedValue({});
      prisma.barangay.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.syncBarangays();

      expect(prisma.barangay.create).toHaveBeenCalledTimes(2);
      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.total).toBe(2);
    });

    it('updates barangays that already exist', async () => {
      const existingBarangay = { id: 'existing-id' };
      http.get.mockReturnValue(of({ data: psgcBarangays }));
      prisma.barangay.findFirst.mockResolvedValue(existingBarangay);
      prisma.barangay.update.mockResolvedValue({});
      prisma.barangay.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.syncBarangays();

      expect(prisma.barangay.update).toHaveBeenCalledTimes(2);
      expect(result.updated).toBe(2);
      expect(result.created).toBe(0);
    });

    it('deactivates barangays no longer in the PSGC feed', async () => {
      http.get.mockReturnValue(of({ data: psgcBarangays }));
      prisma.barangay.findFirst.mockResolvedValue(null);
      prisma.barangay.create.mockResolvedValue({});
      prisma.barangay.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.syncBarangays();

      expect(prisma.barangay.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(result.deactivated).toBe(3);
    });

    it('throws InternalServerErrorException when the PSGC API is unreachable', async () => {
      http.get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

      await expect(service.syncBarangays()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
