import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReviewsAssertions } from './reviews.assertions';
import { BookingStatus, Role } from '@/generated/prisma/enums';

const user = { sub: 'user-id', role: Role.CUSTOMER, phone: '+639171234567' };

const completedBooking = {
  id: 'booking-id',
  status: BookingStatus.COMPLETED,
  workerId: 'worker-profile-id',
  customerId: 'customer-profile-id',
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  const prisma = {
    customerProfile: { findUnique: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
    review: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockAssertions = {
    assertBookingExistsAndCompleted: jest.fn(),
    assertCustomerOwnsBooking: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReviewsAssertions, useValue: mockAssertions },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws ForbiddenException when booking is not COMPLETED', async () => {
    mockAssertions.assertBookingExistsAndCompleted.mockRejectedValue(
      new ForbiddenException('Reviews can only be submitted for completed bookings.'),
    );
    await expect(
      service.create({ bookingId: 'booking-id', rating: 5 }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when caller is not the booking customer', async () => {
    mockAssertions.assertBookingExistsAndCompleted.mockResolvedValue(completedBooking);
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'my-profile-id' });
    mockAssertions.assertCustomerOwnsBooking.mockImplementation(() => {
      throw new ForbiddenException('Only the customer of this booking may submit a review.');
    });

    await expect(
      service.create({ bookingId: 'booking-id', rating: 5 }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException when worker profile is not found', async () => {
    prisma.workerProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.findAllByWorkerId('unknown-id', { skip: 0, take: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('queries reviews by WorkerProfile.id not userId', async () => {
    prisma.workerProfile.findUnique.mockResolvedValue({
      id: 'profile-id',
      userId: 'user-id',
    });
    prisma.review.findMany.mockResolvedValue([]);

    await service.findAllByWorkerId('profile-id', { skip: 0, take: 20 });

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workerId: 'profile-id' } }),
    );
  });
});
