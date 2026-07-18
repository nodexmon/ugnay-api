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
  };

  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
    });

    it('does not throw when the push token is invalid (non-Expo format)', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { ...mockToken, token: 'invalid-non-expo-token' },
      ]);

      await expect(
        service.sendToUser('user-id', { title: 'Hello', body: 'World' }),
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
