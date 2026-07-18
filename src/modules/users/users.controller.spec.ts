import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { UsersController } from '@/modules/users/users.controller';
import { UsersService } from '@/modules/users/users.service';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const user: AuthJwtPayload = { sub: 'user-id', role: Role.WORKER };

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    findMe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getMe', () => {
    it('delegates to usersService.findMe with the current user id', async () => {
      const profile = {
        id: 'user-id',
        phone: '+639171234567',
        role: Role.WORKER,
      };
      usersService.findMe.mockResolvedValue(profile);

      const result = await controller.getMe(user);

      expect(usersService.findMe).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(profile);
    });
  });
});
