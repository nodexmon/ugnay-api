import { Test, TestingModule } from '@nestjs/testing';
import { Platform } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { NotificationsService } from './notifications.service';

const mockToken = {
  userId: 'user-id',
  token: 'ExponentPushToken[valid-token]',
  platform: Platform.IOS,
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    pushToken: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    pushTicket: {
      createMany: jest.fn(),
    },
  };

  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.pushTicket.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('sendToUser', () => {
    it('resolves without sending when the user has no push tokens', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      await expect(
        service.sendToUser('user-id', { title: 'Hello', body: 'World' }),
      ).resolves.toBeUndefined();
      expect(prisma.pushTicket.createMany).not.toHaveBeenCalled();
    });

    it('does not throw when the push token is invalid (non-Expo format)', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { ...mockToken, token: 'invalid-non-expo-token' },
      ]);

      await expect(
        service.sendToUser('user-id', { title: 'Hello', body: 'World' }),
      ).resolves.toBeUndefined();
    });

    it('persists ok tickets after a successful send', async () => {
      prisma.pushToken.findMany.mockResolvedValue([mockToken]);

      const mockExpo = (service as any).expo;
      jest
        .spyOn(mockExpo, 'sendPushNotificationsAsync')
        .mockResolvedValue([{ status: 'ok', id: 'ticket-abc' }]);

      await service.sendToUser('user-id', { title: 'Hi', body: 'There' });

      expect(prisma.pushTicket.createMany).toHaveBeenCalledWith({
        data: [{ ticketId: 'ticket-abc', token: mockToken.token }],
        skipDuplicates: true,
      });
    });

    it('deletes the push token immediately on DeviceNotRegistered error ticket', async () => {
      prisma.pushToken.findMany.mockResolvedValue([mockToken]);
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });

      const mockExpo = (service as any).expo;
      jest.spyOn(mockExpo, 'sendPushNotificationsAsync').mockResolvedValue([
        {
          status: 'error',
          message: 'DeviceNotRegistered',
          details: { error: 'DeviceNotRegistered' },
        },
      ]);

      await service.sendToUser('user-id', { title: 'Hi', body: 'There' });

      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: mockToken.token },
      });
      expect(prisma.pushTicket.createMany).not.toHaveBeenCalled();
    });

    it('does not throw when the ticket persistence fails (bookkeeping swallowed)', async () => {
      prisma.pushToken.findMany.mockResolvedValue([mockToken]);
      prisma.pushTicket.createMany.mockRejectedValue(new Error('DB error'));

      const mockExpo = (service as any).expo;
      jest
        .spyOn(mockExpo, 'sendPushNotificationsAsync')
        .mockResolvedValue([{ status: 'ok', id: 'ticket-xyz' }]);

      await expect(
        service.sendToUser('user-id', { title: 'Hi', body: 'There' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('registerToken', () => {
    it('upserts the push token for the user', async () => {
      prisma.pushToken.upsert.mockResolvedValue(mockToken);

      await service.registerToken('user-id', mockToken.token, Platform.IOS);

      expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: mockToken.token },
          update: { userId: 'user-id', platform: Platform.IOS },
          create: {
            userId: 'user-id',
            token: mockToken.token,
            platform: Platform.IOS,
          },
        }),
      );
    });
  });

  describe('removeToken', () => {
    it('deletes the push token for the user', async () => {
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeToken('user-id', mockToken.token);

      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', token: mockToken.token },
      });
    });
  });
});
