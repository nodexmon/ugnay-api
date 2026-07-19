import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Platform, Role } from '@/generated/prisma/enums';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

const user: AuthJwtPayload = {
  sub: 'user-id',
  role: Role.CUSTOMER,
  phone: '+639171234567',
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const notificationsService = {
    registerToken: jest.fn(),
    removeToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerToken', () => {
    it('delegates to notificationsService.registerToken with userId, token, and platform', async () => {
      notificationsService.registerToken.mockResolvedValue(undefined);

      await controller.registerToken(user, {
        token: 'ExponentPushToken[abc123]',
        platform: Platform.ANDROID,
      });

      expect(notificationsService.registerToken).toHaveBeenCalledWith(
        'user-id',
        'ExponentPushToken[abc123]',
        Platform.ANDROID,
      );
    });
  });

  describe('removeToken', () => {
    it('delegates to notificationsService.removeToken with userId and token', async () => {
      notificationsService.removeToken.mockResolvedValue(undefined);

      await controller.removeToken(user, {
        token: 'ExponentPushToken[abc123]',
      });

      expect(notificationsService.removeToken).toHaveBeenCalledWith(
        'user-id',
        'ExponentPushToken[abc123]',
      );
    });
  });
});
