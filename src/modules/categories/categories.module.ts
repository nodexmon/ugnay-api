import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoriesAssertionsService } from './categories.assertion';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesAssertionsService],
})
export class CategoriesModule {}
