import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { ReviewsAssertions } from './reviews.assertions';

const completedBooking = {
  id: 'booking-id',
  status: BookingStatus.COMPLETED,
  workerId: 'worker-profile-id',
  customerId: 'customer-profile-id',
};

describe('ReviewsAssertions', () => {
  let assertions: ReviewsAssertions;

  const prisma = { booking: { findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<ReviewsAssertions>(ReviewsAssertions);
  });

  describe('assertBookingExistsAndCompleted', () => {
    it('returns the booking when it exists and is COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValue(completedBooking);
      const result = await assertions.assertBookingExistsAndCompleted('booking-id');
      expect(result).toMatchObject({ id: 'booking-id', status: BookingStatus.COMPLETED });
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertBookingExistsAndCompleted('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when booking is not COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...completedBooking,
        status: BookingStatus.ACCEPTED,
      });
      await expect(
        assertions.assertBookingExistsAndCompleted('booking-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertCustomerOwnsBooking', () => {
    it('does not throw when customer IDs match', () => {
      expect(() =>
        assertions.assertCustomerOwnsBooking('profile-id', 'profile-id'),
      ).not.toThrow();
    });

    it('throws ForbiddenException when customer IDs differ', () => {
      expect(() =>
        assertions.assertCustomerOwnsBooking('profile-id', 'other-id'),
      ).toThrow(ForbiddenException);
    });
  });
});
