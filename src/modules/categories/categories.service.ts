import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { Role } from '@/generated/prisma/enums';
import { AuthJwtPayload } from '../auth/auth.types';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findActive(user: AuthJwtPayload) {
    this.assertAdminRole(user.role)

    return await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllForAdmin(user: AuthJwtPayload) {
    this.assertAdminRole(user.role)

    return await this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(user: AuthJwtPayload,dto: CreateCategoryDto) {
    this.assertAdminRole(user.role)

    return await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        iconUrl: dto.iconUrl,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(user: AuthJwtPayload,  categoryId: string, dto: UpdateCategoryDto) {
    this.assertAdminRole(user.role)

    const categoryExist = await this.assertCategoryExist(categoryId)

    return await this.prisma.serviceCategory.update({
      where: { id: categoryExist.id },
      data: dto,
    });
    
  }

  private assertAdminRole(role: Role) {
    if(role !== Role.ADMIN) {
      throw new ForbiddenException("Admin role is required.")
    }
  }

  private async assertCategoryExist(categoryId: string) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id: categoryId } })
    
    if(!category) {
      throw new NotFoundException("Category not found.")
    }

    return category
  }
}
