import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllForAdmin() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        iconUrl: dto.iconUrl,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id: categoryId } })

    if (!category) throw new NotFoundException('Category not found.')

    return this.prisma.serviceCategory.update({
      where: { id: category.id },
      data: dto,
    });
  }
}
