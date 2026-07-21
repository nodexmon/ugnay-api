import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  TimeWindow,
  UserStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsAssertions } from './bookings.assertions';

const pendingBooking = { id: 'booking-id', status: BookingStatus.PENDING };

describe('BookingsAssertions', () => {
  let assertions: BookingsAssertions;

  const prisma = {
    booking: { findUnique: jest.fn(), findFirst: jest.fn() },
    noShowReport: { findUnique: jest.fn() },
    workerProfile: { findUnique: jest.fn() },
    workerCategory: { findUnique: jest.fn() },
    workerServiceArea: { findUnique: jest.fn() },
  };

  const availableWorker = {
    isOnline: true,
    status: WorkerStatus.VERIFIED,
    user: { status: UserStatus.ACTIVE },
  };

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
        user: { status: UserStatus.ACTIVE },
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when worker is not verified', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        isOnline: true,
        status: WorkerStatus.PENDING,
        user: { status: UserStatus.ACTIVE },
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when the worker user account is suspended', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue({
        isOnline: true,
        status: WorkerStatus.VERIFIED,
        user: { status: UserStatus.SUSPENDED },
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws UnprocessableEntityException when worker has an active booking', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(availableWorker);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-id',
        status: BookingStatus.ACCEPTED,
      });
      await expect(
        assertions.assertWorkerIsAvailable('worker-id'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('assertNoShowWindowOpen', () => {
    // scheduledDate = 2026-01-01T00:00:00Z, MORNING window ends 12:00 PST = 04:00 UTC
    const scheduledDate = new Date('2026-01-01T00:00:00Z');
    const booking = { scheduledDate, timeWindow: TimeWindow.MORNING };
    const windowEndUTC = new Date('2026-01-01T04:00:00Z').getTime();
    const deadlineUTC = new Date('2026-01-01T06:00:00Z').getTime();

    afterEach(() => jest.restoreAllMocks());

    it('throws UnprocessableEntityException before the time window ends', () => {
      jest.spyOn(Date, 'now').mockReturnValue(windowEndUTC - 60_000);
      expect(() => assertions.assertNoShowWindowOpen(booking)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('does not throw when within the 2-hour no-show window', () => {
      jest.spyOn(Date, 'now').mockReturnValue(windowEndUTC + 30 * 60_000);
      expect(() => assertions.assertNoShowWindowOpen(booking)).not.toThrow();
    });

    it('throws ForbiddenException after the 2-hour no-show deadline', () => {
      jest.spyOn(Date, 'now').mockReturnValue(deadlineUTC + 60_000);
      expect(() => assertions.assertNoShowWindowOpen(booking)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findWorkerCategoryRate', () => {
    it('returns rateOverride when set', async () => {
      const rateOverride = 500 as never;
      prisma.workerCategory.findUnique.mockResolvedValue({
        rateOverride,
        worker: { baseRate: 300 as never },
      });

      const result = await assertions.findWorkerCategoryRate('w1', 'c1');
      expect(result).toBe(rateOverride);
    });

    it('falls back to worker baseRate when rateOverride is null', async () => {
      const baseRate = 300 as never;
      prisma.workerCategory.findUnique.mockResolvedValue({
        rateOverride: null,
        worker: { baseRate },
      });

      const result = await assertions.findWorkerCategoryRate('w1', 'c1');
      expect(result).toBe(baseRate);
    });

    it('throws UnprocessableEntityException when worker does not offer the category', async () => {
      prisma.workerCategory.findUnique.mockResolvedValue(null);
      await expect(
        assertions.findWorkerCategoryRate('w1', 'unknown-cat'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('assertWorkerServesBarangay', () => {
    it('does not throw when the worker serves the barangay', async () => {
      prisma.workerServiceArea.findUnique.mockResolvedValue({ id: 'area-id' });
      await expect(
        assertions.assertWorkerServesBarangay('w1', 'b1'),
      ).resolves.not.toThrow();
    });

    it('throws UnprocessableEntityException when the worker does not serve the barangay', async () => {
      prisma.workerServiceArea.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerServesBarangay('w1', 'unknown-b'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
