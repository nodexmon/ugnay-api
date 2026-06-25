import { Test, TestingModule } from '@nestjs/testing';
import { WorkersController } from '@/modules/workers/workers.controller';
import { WorkersService } from '@/modules/workers/workers.service';

describe('WorkersController', () => {
  let controller: WorkersController;
  const workersService = {
    search: jest.fn(),
    findPublicProfile: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    setAvailability: jest.fn(),
    submitVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkersController],
      providers: [{ provide: WorkersService, useValue: workersService }],
    }).compile();

    controller = module.get<WorkersController>(WorkersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
