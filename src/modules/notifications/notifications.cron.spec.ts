import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { NotificationsService } from './notifications.service';
import { NotificationsCron } from './notifications.cron';
import { PUSH_TICKET_MAX_AGE_MS } from './notifications.constants';

describe('NotificationsCron', () => {
  let cron: NotificationsCron;

  const prisma = {
    pushTicket: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pushToken: {
      deleteMany: jest.fn(),
    },
  };

  const notificationsService = {
    chunkReceiptIds: jest.fn((ids: string[]) => [ids]),
    getReceipts: jest.fn(),
  };

  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.pushTicket.deleteMany.mockResolvedValue({ count: 0 });
    prisma.pushToken.deleteMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsCron,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    cron = module.get<NotificationsCron>(NotificationsCron);
  });

  it('is a no-op when there are no pending tickets', async () => {
    prisma.pushTicket.findMany.mockResolvedValue([]);

    await cron.checkPushReceipts();

    expect(notificationsService.getReceipts).not.toHaveBeenCalled();
    expect(prisma.pushTicket.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('deletes resolved tickets after fetching receipts', async () => {
    const pending = [
      { id: 'pt1', ticketId: 'r1', token: 'ExponentPushToken[x]' },
    ];
    prisma.pushTicket.findMany.mockResolvedValue(pending);
    notificationsService.getReceipts.mockResolvedValue({
      r1: { status: 'ok' },
    });

    await cron.checkPushReceipts();

    expect(prisma.pushTicket.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticketId: { in: ['r1'] } } }),
    );
  });

  it('prunes the push token on DeviceNotRegistered receipt', async () => {
    const pending = [
      { id: 'pt1', ticketId: 'r1', token: 'ExponentPushToken[dead]' },
    ];
    prisma.pushTicket.findMany.mockResolvedValue(pending);
    notificationsService.getReceipts.mockResolvedValue({
      r1: {
        status: 'error',
        message: 'DeviceNotRegistered',
        details: { error: 'DeviceNotRegistered' },
      },
    });

    await cron.checkPushReceipts();

    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[dead]' },
    });
    expect(prisma.pushTicket.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticketId: { in: ['r1'] } } }),
    );
  });

  it('keeps unresolved tickets (no receipt yet) and only ages out old ones', async () => {
    const pending = [
      { id: 'pt1', ticketId: 'r1', token: 'ExponentPushToken[x]' },
    ];
    prisma.pushTicket.findMany.mockResolvedValue(pending);
    notificationsService.getReceipts.mockResolvedValue({});

    await cron.checkPushReceipts();

    expect(prisma.pushTicket.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { lt: expect.any(Date) } },
      }),
    );
  });

  it('does not abort when a receipt chunk fetch fails', async () => {
    const pending = [
      { id: 'pt1', ticketId: 'r1', token: 'ExponentPushToken[x]' },
    ];
    prisma.pushTicket.findMany.mockResolvedValue(pending);
    notificationsService.getReceipts.mockRejectedValue(new Error('Expo down'));

    await expect(cron.checkPushReceipts()).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  it('ages out tickets older than PUSH_TICKET_MAX_AGE_MS', async () => {
    prisma.pushTicket.findMany.mockResolvedValue([]);

    await cron.checkPushReceipts();

    const deleteCall = prisma.pushTicket.deleteMany.mock.calls.find(
      (call) => call[0]?.where?.createdAt,
    );
    expect(deleteCall).toBeDefined();
    const cutoff: Date = deleteCall[0].where.createdAt.lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      PUSH_TICKET_MAX_AGE_MS - 1000,
    );
  });
});
