import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsAssertions } from './bookings.assertions';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersAssertions } from '@/modules/users/users.assertions';

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: {} },
        {
          provide: BookingsAssertions,
          useValue: {
            assertOwnership: jest.fn(),
            assertBookingExists: jest.fn(),
            assertBookingInStatus: jest.fn(),
            assertNoReportExists: jest.fn(),
            assertWorkerIsAvailable: jest.fn(),
          },
        },
        {
          provide: UsersAssertions,
          useValue: { assertUserExists: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { sendToUser: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
