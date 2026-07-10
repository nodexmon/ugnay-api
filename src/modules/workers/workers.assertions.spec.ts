import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { WorkersAssertions } from './workers.assertions';

describe('WorkersAssertions', () => {
  let assertions: WorkersAssertions;

  const prisma = { workerProfile: { findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkersAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<WorkersAssertions>(WorkersAssertions);
  });

  describe('assertProfileDoesNotExist', () => {
    it('does not throw when no profile exists', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertProfileDoesNotExist('user-id'),
      ).resolves.not.toThrow();
    });

    it('throws ConflictException when a profile already exists', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'profile-id' });
      await expect(
        assertions.assertProfileDoesNotExist('user-id'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('assertUnique', () => {
    it('does not throw when all values are unique', () => {
      expect(() => assertions.assertUnique(['a', 'b', 'c'], 'items')).not.toThrow();
    });

    it('throws BadRequestException when duplicate values are present', () => {
      expect(() => assertions.assertUnique(['a', 'b', 'a'], 'items')).toThrow(
        BadRequestException,
      );
    });
  });
});
