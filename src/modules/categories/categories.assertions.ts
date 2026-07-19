import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CategoriesAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found.');
  }
}
