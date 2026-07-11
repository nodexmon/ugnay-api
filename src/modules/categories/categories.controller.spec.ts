import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoriesAssertions } from './categories.assertions';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const category = { id: 'cat-id', name: 'Plumbing', isActive: true };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            serviceCategory: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: CategoriesAssertions,
          useValue: { assertCategoryExists: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  it('findActive calls service.findActive', async () => {
    jest.spyOn(service, 'findActive').mockResolvedValue([category] as never);
    const result = await controller.findActive();
    expect(service.findActive).toHaveBeenCalled();
    expect(result).toEqual([category]);
  });

  it('findAllForAdmin calls service.findAllForAdmin', async () => {
    jest
      .spyOn(service, 'findAllForAdmin')
      .mockResolvedValue([category] as never);
    const result = await controller.findAllForAdmin();
    expect(service.findAllForAdmin).toHaveBeenCalled();
    expect(result).toEqual([category]);
  });

  it('create calls service.create with the dto', async () => {
    const dto = { name: 'Electrical', slug: 'electrical' };
    jest.spyOn(service, 'create').mockResolvedValue(category as never);
    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(category);
  });

  it('update calls service.update with id and dto', async () => {
    const dto = { name: 'Updated' };
    jest.spyOn(service, 'update').mockResolvedValue(category as never);
    const result = await controller.update('cat-id', dto);
    expect(service.update).toHaveBeenCalledWith('cat-id', dto);
    expect(result).toEqual(category);
  });

  it('deactivate calls service.deactivate with id', async () => {
    jest
      .spyOn(service, 'deactivate')
      .mockResolvedValue({ ...category, isActive: false } as never);
    const result = await controller.deactivate('cat-id');
    expect(service.deactivate).toHaveBeenCalledWith('cat-id');
    expect(result).toMatchObject({ isActive: false });
  });
});
