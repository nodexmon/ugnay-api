import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: { uploadAvatar: jest.Mock; serveFile: jest.Mock };

  beforeEach(async () => {
    uploadsService = {
      uploadAvatar: jest.fn(),
      serveFile: jest.fn(),
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

  it('delegates file serving to the service', () => {
    uploadsService.serveFile.mockReturnValue({ pipe: jest.fn() });
    controller.serveFile('avatars/uuid.jpg');
    expect(uploadsService.serveFile).toHaveBeenCalledWith('avatars/uuid.jpg');
  });
});
