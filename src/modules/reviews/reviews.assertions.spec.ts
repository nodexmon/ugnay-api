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

  const prisma = {
    booking: { findUnique: jest.fn() },
    customerProfile: { findUnique: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
  };

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

  describe('findCompletedBooking', () => {
    it('returns the booking when it exists and is COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValue(completedBooking);
      const result = await assertions.findCompletedBooking('booking-id');
      expect(result).toMatchObject({
        id: 'booking-id',
        status: BookingStatus.COMPLETED,
      });
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        assertions.findCompletedBooking('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when booking is not COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...completedBooking,
        status: BookingStatus.ACCEPTED,
      });
      await expect(
        assertions.findCompletedBooking('booking-id'),
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

  describe('findCustomerProfile', () => {
    it('returns the profile when found', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({ id: 'cp-id' });
      const result = await assertions.findCustomerProfile('user-id');
      expect(result).toEqual({ id: 'cp-id' });
    });

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.findCustomerProfile('user-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertWorkerProfileExists', () => {
    it('does not throw when profile exists', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({ id: 'wp-id' });
      await expect(
        assertions.assertWorkerProfileExists('wp-id'),
      ).resolves.not.toThrow();
    });

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerProfileExists('unknown-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
