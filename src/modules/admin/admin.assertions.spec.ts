import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkerStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminAssertions } from './admin.assertions';

const workerProfile = { id: 'worker-id', status: WorkerStatus.PENDING };
const verifiedWorker = { id: 'worker-id', status: WorkerStatus.VERIFIED };
const booking = { id: 'booking-id' };
const user = { id: 'user-id' };

describe('AdminAssertions', () => {
  let assertions: AdminAssertions;

  const prisma = {
    workerProfile: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAssertions,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    assertions = module.get<AdminAssertions>(AdminAssertions);
  });

  describe('assertWorkerProfileExists', () => {
    it('returns the worker profile when found', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      const result = await assertions.assertWorkerProfileExists('worker-id');
      expect(result).toEqual(workerProfile);
    });

    it('throws NotFoundException when worker profile does not exist', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerProfileExists('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertWorkerIsUnverified', () => {
    it('does not throw when worker is not yet VERIFIED', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(workerProfile);
      await expect(
        assertions.assertWorkerIsUnverified('worker-id'),
      ).resolves.not.toThrow();
    });

    it('throws NotFoundException when worker profile does not exist', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertWorkerIsUnverified('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when worker is already VERIFIED', async () => {
      prisma.workerProfile.findUnique.mockResolvedValue(verifiedWorker);
      await expect(
        assertions.assertWorkerIsUnverified('worker-id'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('assertBookingExists', () => {
    it('returns the booking when found', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      const result = await assertions.assertBookingExists('booking-id');
      expect(result).toEqual(booking);
    });

    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertBookingExists('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertUserExists', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      const result = await assertions.assertUserExists('user-id');
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        assertions.assertUserExists('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
