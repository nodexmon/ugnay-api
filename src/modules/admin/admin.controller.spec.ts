import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const adminJwt = { sub: 'admin-id', role: Role.ADMIN, phone: '' };

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockService = {
    findUsers: jest.fn(),
    findWorkers: jest.fn(),
    findBookings: jest.fn(),
    findPendingVerifications: jest.fn(),
    approveVerification: jest.fn(),
    rejectVerification: jest.fn(),
    setUserSuspension: jest.fn(),
    strikeWorker: jest.fn(),
    findPendingNoShows: jest.fn(),
    resolveNoShow: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('listUsers calls service.findUsers with the query', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findUsers.mockResolvedValue({ items: [], total: 0 });
    await controller.listUsers(query as never);
    expect(service.findUsers).toHaveBeenCalledWith(query);
  });

  it('listWorkers calls service.findWorkers with the query', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findWorkers.mockResolvedValue({ items: [], total: 0 });
    await controller.listWorkers(query as never);
    expect(service.findWorkers).toHaveBeenCalledWith(query);
  });

  it('listBookings calls service.findBookings with the query', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findBookings.mockResolvedValue({ items: [], total: 0 });
    await controller.listBookings(query as never);
    expect(service.findBookings).toHaveBeenCalledWith(query);
  });

  it('listPendingVerifications calls service.findPendingVerifications', async () => {
    mockService.findPendingVerifications.mockResolvedValue([]);
    await controller.listPendingVerifications();
    expect(service.findPendingVerifications).toHaveBeenCalled();
  });

  it('approveVerification calls service.approveVerification with id and user', async () => {
    mockService.approveVerification.mockResolvedValue({});
    await controller.approveVerification(adminJwt, 'doc-id');
    expect(service.approveVerification).toHaveBeenCalledWith('doc-id', adminJwt);
  });

  it('rejectVerification calls service.rejectVerification with id, user, and reason', async () => {
    mockService.rejectVerification.mockResolvedValue({});
    await controller.rejectVerification(adminJwt, 'doc-id', { reason: 'Bad photo' });
    expect(service.rejectVerification).toHaveBeenCalledWith('doc-id', adminJwt, 'Bad photo');
  });

  it('setUserSuspension calls service.setUserSuspension with id and suspended flag', async () => {
    mockService.setUserSuspension.mockResolvedValue({});
    await controller.setUserSuspension('user-id', { suspended: true });
    expect(service.setUserSuspension).toHaveBeenCalledWith('user-id', true);
  });

  it('strikeWorker calls service.strikeWorker with user and dto', async () => {
    const dto = { workerId: 'worker-id', reason: 'CUSTOMER_COMPLAINT' };
    mockService.strikeWorker.mockResolvedValue({});
    await controller.strikeWorker(adminJwt, dto as never);
    expect(service.strikeWorker).toHaveBeenCalledWith(adminJwt, dto);
  });

  it('listPendingNoShows calls service.findPendingNoShows', async () => {
    mockService.findPendingNoShows.mockResolvedValue([]);
    await controller.listPendingNoShows();
    expect(service.findPendingNoShows).toHaveBeenCalled();
  });

  it('resolveNoShow calls service.resolveNoShow with id, user, and dto', async () => {
    const dto = { confirmed: true };
    mockService.resolveNoShow.mockResolvedValue({ resolved: true });
    await controller.resolveNoShow(adminJwt, 'report-id', dto as never);
    expect(service.resolveNoShow).toHaveBeenCalledWith('report-id', adminJwt, dto);
  });
});
