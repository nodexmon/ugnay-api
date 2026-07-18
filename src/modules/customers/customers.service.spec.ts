import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { CustomersAssertions } from './customers.assertions';
import { PrismaService } from '@/prisma/prisma.service';

describe('CustomersService', () => {
  let service: CustomersService;

  const prisma = {
    customerProfile: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const assertions = {
    findCustomerProfile: jest.fn(),
    assertCustomerProfileDoesNotExist: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersAssertions, useValue: assertions },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('throws NotFoundException when profile does not exist', async () => {
    assertions.findCustomerProfile.mockRejectedValueOnce(
      new NotFoundException('Customer profile not found.'),
    );
    await expect(service.findProfile('user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ConflictException when profile already exists on create', async () => {
    assertions.assertCustomerProfileDoesNotExist.mockRejectedValueOnce(
      new ConflictException('Customer profile already exists.'),
    );
    await expect(
      service.createProfile('user-id', {
        firstName: 'Ana',
        lastName: 'Santos',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a profile when none exists', async () => {
    prisma.customerProfile.create.mockResolvedValue({
      id: 'profile-id',
      firstName: 'Ana',
    });

    const result = await service.createProfile('user-id', {
      firstName: 'Ana',
      lastName: 'Santos',
    });
    expect(result).toHaveProperty('id', 'profile-id');
  });
});
