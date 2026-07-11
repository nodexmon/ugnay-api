import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersAssertions } from './users.assertions';

const activeUser = { id: 'user-id', status: UserStatus.ACTIVE };
const suspendedUser = { id: 'user-id', status: UserStatus.SUSPENDED };

describe('UsersAssertions', () => {
  let assertions: UsersAssertions;

  const prisma = { user: { findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<UsersAssertions>(UsersAssertions);
  });

  describe('assertUserExists', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const result = await assertions.assertUserExists('user-id');
      expect(result).toEqual(activeUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertUserExists('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertUserIsActive', () => {
    it('returns the user when found and ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const result = await assertions.assertUserIsActive('user-id');
      expect(result).toEqual(activeUser);
    });

    it('throws ForbiddenException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertUserIsActive('missing'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when user is not ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue(suspendedUser);
      await expect(
        assertions.assertUserIsActive('user-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
