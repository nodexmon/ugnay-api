import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('CustomersService', () => {
  let service: CustomersService;
  const prisma = {
    customerProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('throws NotFoundException when profile does not exist', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue(null);
    await expect(service.getProfile('user-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when profile already exists on create', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'profile-id' });
    await expect(
      service.createProfile('user-id', { firstName: 'Ana', lastName: 'Santos' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a profile when none exists', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue(null);
    prisma.customerProfile.create.mockResolvedValue({ id: 'profile-id', firstName: 'Ana' });

    const result = await service.createProfile('user-id', { firstName: 'Ana', lastName: 'Santos' });
    expect(result).toHaveProperty('id', 'profile-id');
  });
});
