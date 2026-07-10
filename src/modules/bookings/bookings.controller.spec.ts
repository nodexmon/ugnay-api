import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsAssertions } from './bookings.assertions';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificationsService, useValue: { sendToUser: jest.fn() } },
        {
          provide: BookingsAssertions,
          useValue: {
            assertRole: jest.fn(),
            assertOwnership: jest.fn(),
            assertBookingInStatus: jest.fn(),
            assertNoReportExists: jest.fn(),
            assertWorkerIsAvailable: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
