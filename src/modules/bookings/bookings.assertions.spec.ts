import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, WorkerStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsAssertions } from './bookings.assertions';

const pendingBooking = { id: 'booking-id', status: BookingStatus.PENDING };

describe('BookingsAssertions', () => {
  let assertions: BookingsAssertions;

  const prisma = {
    booking: { findUnique: jest.fn(), findFirst: jest.fn() },
    noShowReport: { findUnique: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
  };

  const availableWorker = { isOnline: true, status: WorkerStatus.VERIFIED };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<BookingsAssertions>(BookingsAssertions);
  });

  describe('assertOwnership', () => {
    it('does not throw when IDs match', () => {
      expect(() => assertions.assertOwnership('abc', 'abc')).not.toThrow();
    });

    it('throws ForbiddenException when IDs differ', () => {
      expect(() => assertions.assertOwnership('abc', 'xyz')).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findBooking', () => {
    it('returns the booking when found', async () => {
      prisma.booking.findUnique.mockResolvedValue(pendingBooking);
      const result = await assertions.findBooking('booking-id');
      expect(result).toEqual(pendingBooking);
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(assertions.findBooking('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertBookingInStatus', () => {
    it('does not throw when status is in the allowed list', () => {
      expect(() =>
        assertions.assertBookingInStatus(
          BookingStatus.PENDING,
          BookingStatus.PENDING,
          BookingStatus.ACCEPTED,
        ),
      ).not.toThrow();
    });

    it('throws ForbiddenException when status is not allowed', () => {
      expect(() =>
        assertions.assertBookingInStatus(
          BookingStatus.COMPLETED,
          BookingStatus.PENDING,
        ),
      ).toThrow(ForbiddenException);
    });

    it('includes allowed statuses in the error message', () => {
      try {
        assertions.assertBookingInStatus(
          BookingStatus.COMPLETED,
          BookingStatus.PENDING,
          BookingStatus.ACCEPTED,
        );
      } catch (e: unknown) {
        expect((e as ForbiddenException).message).toContain('PENDING');
        expect((e as ForbiddenException).message).toContain('ACCEPTED');
      }
    });
  });

  describe('assertNoReportExists', () => {
    it('does not throw when no report exists', async () => {
      prisma.noShowReport.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertNoReportExists('booking-id'),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when a report already exists', async () => {
      prisma.noShowReport.findUnique.mockResolvedValue({ id: 'report-id' });
      await expect(
        assertions.assertNoReportExists('booking-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertWorkerIsAvailable', () => {
    it('does not throw when worker is online, verified, and has no active booking', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(availableWorker);
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when worker profile does not exist', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when worker is offline', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        isOnline: false,
        status: WorkerStatus.VERIFIED,
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when worker is not verified', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        isOnline: true,
        status: WorkerStatus.PENDING,
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when worker has an active booking', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(availableWorker);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-id',
        status: BookingStatus.ACCEPTED,
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
