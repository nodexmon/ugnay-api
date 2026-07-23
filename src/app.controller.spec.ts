import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('returns { status: ok, db: up } when the database is reachable', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(appController.checkHealth()).resolves.toEqual({
        status: 'ok',
        db: 'up',
      });
    });

    it('throws ServiceUnavailableException when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      await expect(appController.checkHealth()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
