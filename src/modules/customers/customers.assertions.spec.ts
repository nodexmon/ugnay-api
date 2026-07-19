import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersAssertions } from './customers.assertions';
import { PrismaService } from '@/prisma/prisma.service';

describe('CustomersAssertions', () => {
  let assertions: CustomersAssertions;
  const prisma = {
    customerProfile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    assertions = module.get<CustomersAssertions>(CustomersAssertions);
  });

  describe('findCustomerProfile', () => {
    it('returns the profile when found', async () => {
      const profile = { id: 'profile-id', userId: 'user-id' };
      prisma.customerProfile.findUnique.mockResolvedValue(profile);

      const result = await assertions.findCustomerProfile('user-id');

      expect(result).toBe(profile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(
        assertions.findCustomerProfile('unknown-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertCustomerProfileDoesNotExist', () => {
    it('does not throw when no profile exists', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(
        assertions.assertCustomerProfileDoesNotExist('user-id'),
      ).resolves.toBeUndefined();
    });

    it('throws ConflictException when a profile already exists', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({ id: 'profile-id' });

      await expect(
        assertions.assertCustomerProfileDoesNotExist('user-id'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
