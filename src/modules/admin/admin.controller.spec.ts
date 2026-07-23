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
    findPendingCredentials: jest.fn(),
    approveCredential: jest.fn(),
    rejectCredential: jest.fn(),
    setUserSuspension: jest.fn(),
    createAdmin: jest.fn(),
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
    await controller.listUsers(query);
    expect(service.findUsers).toHaveBeenCalledWith(query);
  });

  it('listWorkers calls service.findWorkers with the query', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findWorkers.mockResolvedValue({ items: [], total: 0 });
    await controller.listWorkers(query);
    expect(service.findWorkers).toHaveBeenCalledWith(query);
  });

  it('listBookings calls service.findBookings with the query', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findBookings.mockResolvedValue({ items: [], total: 0 });
    await controller.listBookings(query);
    expect(service.findBookings).toHaveBeenCalledWith(query);
  });

  it('listPendingVerifications calls service.findPendingVerifications', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findPendingVerifications.mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      take: 10,
    });
    await controller.listPendingVerifications(query);
    expect(service.findPendingVerifications).toHaveBeenCalledWith(query);
  });

  it('approveVerification calls service.approveVerification with id and user', async () => {
    mockService.approveVerification.mockResolvedValue({});
    await controller.approveVerification(adminJwt, 'doc-id');
    expect(service.approveVerification).toHaveBeenCalledWith(
      'doc-id',
      adminJwt,
    );
  });

  it('rejectVerification calls service.rejectVerification with id, user, and reason', async () => {
    mockService.rejectVerification.mockResolvedValue({});
    await controller.rejectVerification(adminJwt, 'doc-id', {
      reason: 'Bad photo',
    });
    expect(service.rejectVerification).toHaveBeenCalledWith(
      'doc-id',
      adminJwt,
      'Bad photo',
    );
  });

  it('listPendingCredentials calls service.findPendingCredentials', async () => {
    const query = { skip: 0, take: 10 };
    mockService.findPendingCredentials.mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      take: 10,
    });
    await controller.listPendingCredentials(query);
    expect(service.findPendingCredentials).toHaveBeenCalledWith(query);
  });

  it('approveCredential calls service.approveCredential with id and user', async () => {
    mockService.approveCredential.mockResolvedValue({});
    await controller.approveCredential(adminJwt, 'cred-id');
    expect(service.approveCredential).toHaveBeenCalledWith('cred-id', adminJwt);
  });

  it('rejectCredential calls service.rejectCredential with id, user, and reason', async () => {
    mockService.rejectCredential.mockResolvedValue({});
    await controller.rejectCredential(adminJwt, 'cred-id', {
      reason: 'Certificate expired',
    });
    expect(service.rejectCredential).toHaveBeenCalledWith(
      'cred-id',
      adminJwt,
      'Certificate expired',
    );
  });

  it('createAdmin calls service.createAdmin with the dto', async () => {
    const dto = { phone: '+639171234567' };
    mockService.createAdmin.mockResolvedValue({ id: 'new-admin-id' });
    await controller.createAdmin(dto);
    expect(service.createAdmin).toHaveBeenCalledWith(dto);
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
    const query = { skip: 0, take: 10 };
    mockService.findPendingNoShows.mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      take: 10,
    });
    await controller.listPendingNoShows(query);
    expect(service.findPendingNoShows).toHaveBeenCalledWith(query);
  });

  it('resolveNoShow calls service.resolveNoShow with id, user, and dto', async () => {
    const dto = { confirmed: true };
    mockService.resolveNoShow.mockResolvedValue({ resolved: true });
    await controller.resolveNoShow(adminJwt, 'report-id', dto);
    expect(service.resolveNoShow).toHaveBeenCalledWith(
      'report-id',
      adminJwt,
      dto,
    );
  });
});
