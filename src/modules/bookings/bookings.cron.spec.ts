import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Logger } from 'nestjs-pino';
import { BookingsCron } from './bookings.cron';

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

  it('expires past-due pending bookings and notifies each customer', async () => {
    const expired = [
      { id: 'b1', customer: { userId: 'u1' } },
      { id: 'b2', customer: { userId: 'u2' } },
    ];
    prisma.booking.findMany.mockResolvedValue(expired);
    prisma.booking.updateMany.mockResolvedValue({ count: 2 });
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
    expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ title: 'Booking expired' }),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u2',
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
    const expired = [
      { id: 'b1', customer: { userId: 'u1' } },
      { id: 'b2', customer: { userId: 'u2' } },
    ];
    prisma.booking.findMany.mockResolvedValue(expired);
    prisma.booking.updateMany.mockResolvedValue({ count: 2 });
    notifications.sendToUser
      .mockRejectedValueOnce(new Error('push failed'))
      .mockResolvedValueOnce(undefined);

    await expect(cron.expiredPendingBookings()).resolves.not.toThrow();
    expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
  });
});
