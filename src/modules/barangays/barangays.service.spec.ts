import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { BarangaysService } from './barangays.service';

const barangays = [
  { id: '1', name: 'Bagong Silang', centroidLat: 14.7, centroidLng: 121.0 },
  { id: '2', name: 'Batasan Hills', centroidLat: 14.7, centroidLng: 121.1 },
];

describe('BarangaysService', () => {
  let service: BarangaysService;

  const prisma = { barangay: { findMany: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarangaysService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<BarangaysService>(BarangaysService);
  });

  describe('findAll', () => {
    it('returns only active barangays ordered by name', async () => {
      prisma.barangay.findMany.mockResolvedValue(barangays);

      const result = await service.findAll();

      expect(prisma.barangay.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: expect.objectContaining({ id: true, name: true }),
        }),
      );
      expect(result).toEqual(barangays);
    });

    it('returns an empty list when no active barangays exist', async () => {
      prisma.barangay.findMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });
});
