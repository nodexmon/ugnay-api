import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";


@Injectable()
export class CategoriesAssertionsService {
    constructor(private readonly prisma: PrismaService) { }

    async assertCategoryExists(categoryId: string): Promise<void> {
        const category = await this.prisma.serviceCategory.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundException('Category does not exist.');
        }
    }

}