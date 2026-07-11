import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReviewsAssertions } from './reviews.assertions';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: {} },
        {
          provide: ReviewsAssertions,
          useValue: {
            assertBookingExistsAndCompleted: jest.fn(),
            assertCustomerOwnsBooking: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
