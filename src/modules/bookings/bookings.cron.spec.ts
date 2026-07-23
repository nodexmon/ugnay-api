import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, TimeWindow } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Logger } from 'nestjs-pino';
import { BookingsCron } from './bookings.cron';
import {
  STALE_ACCEPTED_GRACE_MS,
  getTimeWindowEndUtcMs,
} from './bookings.constants';

describe('BookingsCron', () => {
  let cron: BookingsCron;

  const prisma = {
    booking: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const notifications = { sendToUser: jest.fn() };
  const logger = { log: jest.fn(), error: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsCron,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    cron = module.get<BookingsCron>(BookingsCron);
  });

  describe('expiredPendingBookings', () => {
    it('expires past-due pending bookings and notifies only confirmed-expired customers', async () => {
      const candidates = [
        { id: 'b1', customer: { userId: 'u1' } },
        { id: 'b2', customer: { userId: 'u2' } },
      ];
      const confirmedExpired = [{ id: 'b1', customer: { userId: 'u1' } }];
      prisma.booking.findMany
        .mockResolvedValueOnce(candidates)
        .mockResolvedValueOnce(confirmedExpired);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      notifications.sendToUser.mockResolvedValue(undefined);

      await cron.expiredPendingBookings();

      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['b1', 'b2'] },
            status: BookingStatus.PENDING,
          }),
          data: { status: BookingStatus.EXPIRED },
        }),
      );
      expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ title: 'Booking expired' }),
      );
    });

    it('is a no-op when there are no expired pending bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await cron.expiredPendingBookings();

      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('does not abort the batch when a notification fails for one customer', async () => {
      const candidates = [
        { id: 'b1', customer: { userId: 'u1' } },
        { id: 'b2', customer: { userId: 'u2' } },
      ];
      prisma.booking.findMany
        .mockResolvedValueOnce(candidates)
        .mockResolvedValueOnce(candidates);
      prisma.booking.updateMany.mockResolvedValue({ count: 2 });
      notifications.sendToUser
        .mockRejectedValueOnce(new Error('push failed'))
        .mockResolvedValueOnce(undefined);

      await expect(cron.expiredPendingBookings()).resolves.not.toThrow();
      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelStaleAcceptedBookings', () => {
    const staleDate = new Date(
      Date.now() - STALE_ACCEPTED_GRACE_MS - 3 * 60 * 60 * 1000,
    );
    const windowEndMs = getTimeWindowEndUtcMs(staleDate, TimeWindow.MORNING);

    function makeStaleBooking(
      id: string,
      customerId: string,
      workerId: string,
    ) {
      return {
        id,
        scheduledDate: new Date(
          windowEndMs - STALE_ACCEPTED_GRACE_MS - 60 * 60 * 1000,
        ),
        timeWindow: TimeWindow.MORNING,
        customer: { userId: customerId },
        worker: { userId: workerId },
      };
    }

    it('cancels bookings past the grace window and notifies both parties', async () => {
      const booking = makeStaleBooking('b1', 'cu1', 'wu1');
      prisma.booking.findMany
        .mockResolvedValueOnce([booking])
        .mockResolvedValueOnce([
          {
            id: 'b1',
            customer: { userId: 'cu1' },
            worker: { userId: 'wu1' },
          },
        ]);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      notifications.sendToUser.mockResolvedValue(undefined);

      await cron.cancelStaleAcceptedBookings();

      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['b1'] },
            status: BookingStatus.ACCEPTED,
          }),
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            cancellationActor: 'SYSTEM',
          }),
        }),
      );
      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    });

    it('skips bookings that are within the grace window', async () => {
      // scheduledDate such that windowEnd + GRACE is in the future
      const futureWindowEnd = new Date(
        Date.now() - STALE_ACCEPTED_GRACE_MS / 2,
      );
      const notStaleYet = {
        id: 'b-recent',
        scheduledDate: futureWindowEnd,
        timeWindow: TimeWindow.MORNING,
        customer: { userId: 'cu1' },
        worker: { userId: 'wu1' },
      };
      prisma.booking.findMany.mockResolvedValueOnce([notStaleYet]);

      await cron.cancelStaleAcceptedBookings();

      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('skips bookings that have a no-show report (DB filter handles these)', async () => {
      prisma.booking.findMany.mockResolvedValueOnce([]);

      await cron.cancelStaleAcceptedBookings();

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ noShowReport: null }),
        }),
      );
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('is a no-op when there are no stale accepted bookings', async () => {
      prisma.booking.findMany.mockResolvedValueOnce([]);

      await cron.cancelStaleAcceptedBookings();

      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });
  });
});
