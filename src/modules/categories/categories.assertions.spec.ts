import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoriesAssertions } from './categories.assertions';

const category = { id: 'cat-id', name: 'Plumbing', isActive: true };

describe('CategoriesAssertions', () => {
  let assertions: CategoriesAssertions;

  const prisma = { serviceCategory: { findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<CategoriesAssertions>(CategoriesAssertions);
  });

  describe('assertCategoryExists', () => {
    it('returns the category when found', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(category);
      const result = await assertions.assertCategoryExists('cat-id');
      expect(result).toEqual(category);
    });

    it('throws NotFoundException when category does not exist', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertCategoryExists('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
