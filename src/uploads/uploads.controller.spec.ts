import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const worker: AuthJwtPayload = { sub: 'worker-user-id', role: Role.WORKER };

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: {
    uploadAvatar: jest.Mock;
    serveAvatar: jest.Mock;
    serveProtectedFile: jest.Mock;
  };

  beforeEach(async () => {
    uploadsService = {
      uploadAvatar: jest.fn(),
      serveAvatar: jest.fn(),
      serveProtectedFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: uploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates avatar serving to the service', () => {
    uploadsService.serveAvatar.mockReturnValue({ pipe: jest.fn() });
    controller.serveAvatar('uuid.jpg');
    expect(uploadsService.serveAvatar).toHaveBeenCalledWith('uuid.jpg');
  });

  it('delegates protected file serving to the service with the caller', async () => {
    uploadsService.serveProtectedFile.mockResolvedValue({ pipe: jest.fn() });
    await controller.serveProtectedFile(
      worker,
      'verification/worker-1/idPhoto-uuid.jpg',
    );
    expect(uploadsService.serveProtectedFile).toHaveBeenCalledWith(
      worker,
      'verification/worker-1/idPhoto-uuid.jpg',
    );
  });
});
