import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('returns the current user profile', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id' });

    await expect(service.findMe('user-id')).resolves.toEqual({ id: 'user-id' });
  });

  it('throws when current user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findMe('user-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
