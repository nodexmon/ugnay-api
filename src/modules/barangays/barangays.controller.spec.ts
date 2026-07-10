import { Test, TestingModule } from '@nestjs/testing';
import { BarangaysController } from './barangays.controller';
import { BarangaysService } from './barangays.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('BarangaysController', () => {
  let controller: BarangaysController;
  let service: BarangaysService;

  const barangays = [{ id: '1', name: 'Bagong Silang' }];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BarangaysController],
      providers: [
        BarangaysService,
        { provide: PrismaService, useValue: { barangay: { findMany: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<BarangaysController>(BarangaysController);
    service = module.get<BarangaysService>(BarangaysService);
  });

  it('calls service.findAll and returns the result', async () => {
    jest.spyOn(service, 'findAll').mockResolvedValue(barangays as never);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(barangays);
  });
});
