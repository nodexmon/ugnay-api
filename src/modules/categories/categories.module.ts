import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoriesAssertions } from './categories.assertions';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesAssertions],
})
export class CategoriesModule {}
