import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoriesService } from './categories.service';

const category = {
  id: 'cat-id',
  name: 'Plumbing',
  slug: 'plumbing',
  isActive: true,
  sortOrder: 0,
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  const prisma = {
    serviceCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findActive', () => {
    it('returns only active categories', async () => {
      prisma.serviceCategory.findMany.mockResolvedValue([category]);
      const result = await service.findActive();
      expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(result).toEqual([category]);
    });
  });

  describe('findAllForAdmin', () => {
    it('returns all categories including inactive', async () => {
      const inactive = { ...category, isActive: false };
      prisma.serviceCategory.findMany.mockResolvedValue([category, inactive]);
      const result = await service.findAllForAdmin();
      expect(result).toHaveLength(2);
      expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing-id', { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(category);
      prisma.serviceCategory.update.mockResolvedValue({
        ...category,
        isActive: false,
      });

      const result = await service.deactivate('cat-id');

      expect(prisma.serviceCategory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-id' },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('is idempotent — deactivating an already-inactive category succeeds', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue({
        ...category,
        isActive: false,
      });
      prisma.serviceCategory.update.mockResolvedValue({
        ...category,
        isActive: false,
      });

      await expect(service.deactivate('cat-id')).resolves.not.toThrow();
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
