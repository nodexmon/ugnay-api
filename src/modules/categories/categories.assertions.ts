import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ServiceCategory } from '@/generated/prisma/client';

@Injectable()
export class CategoriesAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertCategoryExists(categoryId: string): Promise<ServiceCategory> {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category does not exist.');
    return category;
  }
}
