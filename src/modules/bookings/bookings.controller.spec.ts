import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import type { AuthJwtPayload } from '../auth/auth.types';

const user: AuthJwtPayload = { sub: 'user-id', role: Role.CUSTOMER };
const bookingId = 'booking-id';
const booking = { id: bookingId, status: 'PENDING' };

describe('BookingsController', () => {
  let controller: BookingsController;

  const bookingsService = {
    create: jest.fn(),
    findMany: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    accept: jest.fn(),
    reject: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    reportNoShow: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: bookingsService }],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  describe('create', () => {
    it('delegates to bookingsService.create with user and dto', async () => {
      const dto = {
        workerId: 'worker-id',
        categoryId: 'cat-id',
        scheduledDate: new Date(),
      };
      bookingsService.create.mockResolvedValue(booking);

      const result = await controller.create(user, dto as any);

      expect(bookingsService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(booking);
    });
  });

  describe('findMany', () => {
    it('delegates to bookingsService.findMany with user and query', async () => {
      bookingsService.findMany.mockResolvedValue([booking]);

      const result = await controller.findMany(user, {} as any);

      expect(bookingsService.findMany).toHaveBeenCalledWith(user, {});
      expect(result).toEqual([booking]);
    });
  });

  describe('findOne', () => {
    it('delegates to bookingsService.findOne with id and user', async () => {
      bookingsService.findOne.mockResolvedValue(booking);

      const result = await controller.findOne(user, bookingId);

      expect(bookingsService.findOne).toHaveBeenCalledWith(bookingId, user);
      expect(result).toEqual(booking);
    });
  });

  describe('accept', () => {
    it('delegates to bookingsService.accept with id and user', async () => {
      bookingsService.accept.mockResolvedValue({
        ...booking,
        status: 'ACCEPTED',
      });

      const result = await controller.accept(user, bookingId);

      expect(bookingsService.accept).toHaveBeenCalledWith(bookingId, user);
      expect(result).toMatchObject({ status: 'ACCEPTED' });
    });
  });

  describe('reject', () => {
    it('delegates to bookingsService.reject with id and user', async () => {
      bookingsService.reject.mockResolvedValue({
        ...booking,
        status: 'REJECTED',
      });

      const result = await controller.reject(user, bookingId);

      expect(bookingsService.reject).toHaveBeenCalledWith(bookingId, user);
      expect(result).toMatchObject({ status: 'REJECTED' });
    });
  });

  describe('start', () => {
    it('delegates to bookingsService.start with id and user', async () => {
      bookingsService.start.mockResolvedValue({
        ...booking,
        status: 'IN_PROGRESS',
      });

      const result = await controller.start(user, bookingId);

      expect(bookingsService.start).toHaveBeenCalledWith(bookingId, user);
      expect(result).toMatchObject({ status: 'IN_PROGRESS' });
    });
  });

  describe('complete', () => {
    it('delegates to bookingsService.complete with id and user', async () => {
      bookingsService.complete.mockResolvedValue({
        ...booking,
        status: 'COMPLETED',
      });

      const result = await controller.complete(user, bookingId);

      expect(bookingsService.complete).toHaveBeenCalledWith(bookingId, user);
      expect(result).toMatchObject({ status: 'COMPLETED' });
    });
  });

  describe('cancel', () => {
    it('delegates to bookingsService.cancel with id, user, and dto', async () => {
      const dto = { reason: 'Changed my mind' };
      bookingsService.cancel.mockResolvedValue({
        ...booking,
        status: 'CANCELLED',
      });

      const result = await controller.cancel(user, bookingId, dto as any);

      expect(bookingsService.cancel).toHaveBeenCalledWith(bookingId, user, dto);
      expect(result).toMatchObject({ status: 'CANCELLED' });
    });
  });

  describe('reportNoShow', () => {
    it('delegates to bookingsService.reportNoShow with id, user, and description', async () => {
      const dto = { description: 'Worker did not show up' };
      bookingsService.reportNoShow.mockResolvedValue({ reported: true });

      const result = await controller.reportNoShow(user, bookingId, dto as any);

      expect(bookingsService.reportNoShow).toHaveBeenCalledWith(
        bookingId,
        user,
        dto.description,
      );
      expect(result).toEqual({ reported: true });
    });
  });
});
