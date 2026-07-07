import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  findActive() {
    return this.categoriesService.findActive();
  }

  @CheckAbility(Action.Manage, 'all')
  @Get('admin')
  findAllForAdmin() {
    return this.categoriesService.findAllForAdmin();
  }

  @CheckAbility(Action.Create, 'ServiceCategory')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @CheckAbility(Action.Update, 'ServiceCategory')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }
}
