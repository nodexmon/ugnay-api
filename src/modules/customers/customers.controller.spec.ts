import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Role } from '@/generated/prisma/enums';
import { AuthJwtPayload } from '@/modules/auth/auth.types';

describe('CustomersController', () => {
  let controller: CustomersController;
  let customersService: {
    findProfile: jest.Mock;
    createProfile: jest.Mock;
    updateProfile: jest.Mock;
  };

  const user: AuthJwtPayload = {
    sub: 'user-id',
    phone: '+639171234567',
    role: Role.CUSTOMER,
  };

  beforeEach(async () => {
    customersService = {
      findProfile: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: customersService }],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findProfile to the service', () => {
    customersService.findProfile.mockResolvedValue({ id: 'profile-id' });
    controller.findProfile(user);
    expect(customersService.findProfile).toHaveBeenCalledWith(user.sub);
  });

  it('delegates createProfile to the service', () => {
    const dto = { firstName: 'Ana', lastName: 'Santos' };
    customersService.createProfile.mockResolvedValue({ id: 'profile-id' });
    controller.createProfile(user, dto);
    expect(customersService.createProfile).toHaveBeenCalledWith(user.sub, dto);
  });
});
