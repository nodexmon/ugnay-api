import { Test, TestingModule } from '@nestjs/testing';
import { WorkersController } from '@/modules/workers/workers.controller';
import { WorkersService } from '@/modules/workers/workers.service';
import { Role } from '@/generated/prisma/enums';
import { AuthJwtPayload } from '@/modules/auth/auth.types';

describe('WorkersController', () => {
  let controller: WorkersController;
  let workersService: {
    search: jest.Mock;
    findPublicProfile: jest.Mock;
    createProfile: jest.Mock;
    updateProfile: jest.Mock;
    setAvailability: jest.Mock;
    submitVerification: jest.Mock;
  };

  const user: AuthJwtPayload = {
    sub: 'user-id',
    phone: '+639171234567',
    role: Role.WORKER,
  };

  beforeEach(async () => {
    workersService = {
      search: jest.fn(),
      findPublicProfile: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
      setAvailability: jest.fn(),
      submitVerification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkersController],
      providers: [{ provide: WorkersService, useValue: workersService }],
    }).compile();

    controller = module.get<WorkersController>(WorkersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes search filters to the service', () => {
    const query = { categoryId: 'category-id', barangayId: 'barangay-id' };
    const expected = [{ id: 'worker-id' }];
    workersService.search.mockResolvedValue(expected);

    expect(controller.search(query)).resolves.toBe(expected);
    expect(workersService.search).toHaveBeenCalledWith(query);
  });

  it('loads a public worker profile by id', () => {
    const expected = { id: 'worker-id' };
    workersService.findPublicProfile.mockResolvedValue(expected);

    expect(controller.findOne('worker-id')).resolves.toBe(expected);
    expect(workersService.findPublicProfile).toHaveBeenCalledWith('worker-id');
  });

  it('creates a profile for the authenticated worker', () => {
    const dto = {
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      baseRate: 500,
      homeBarangayId: 'barangay-id',
      categories: [{ categoryId: 'category-id' }],
      serviceAreaBarangayIds: ['barangay-id'],
    };
    const expected = { id: 'profile-id' };
    workersService.createProfile.mockResolvedValue(expected);

    expect(controller.createProfile(user, dto)).resolves.toBe(expected);
    expect(workersService.createProfile).toHaveBeenCalledWith(
      user.sub,
      dto,
    );
  });

  it('updates a profile for the authenticated worker', () => {
    const dto = { bio: 'Reliable home cleaner' };
    const expected = { id: 'profile-id', bio: dto.bio };
    workersService.updateProfile.mockResolvedValue(expected);

    expect(controller.updateProfile(user, dto)).resolves.toBe(expected);
    expect(workersService.updateProfile).toHaveBeenCalledWith(
      user.sub,
      dto,
    );
  });

  it('sets availability using only the dto boolean', () => {
    const expected = { isOnline: true };
    workersService.setAvailability.mockResolvedValue(expected);

    expect(controller.setAvailability(user, { isOnline: true })).resolves.toBe(
      expected,
    );
    expect(workersService.setAvailability).toHaveBeenCalledWith(
      user.sub,
      true,
    );
  });

  it('submits verification files for the authenticated worker', () => {
    const files = {
      idPhoto: [{ filename: 'id.jpg' }],
      selfie: [{ filename: 'selfie.jpg' }],
    };
    const expected = { status: 'PENDING' };
    workersService.submitVerification.mockResolvedValue(expected);

    expect(controller.submitVerification(user, files as never)).resolves.toBe(
      expected,
    );
    expect(workersService.submitVerification).toHaveBeenCalledWith(
      user.sub,
      files,
    );
  });
});
