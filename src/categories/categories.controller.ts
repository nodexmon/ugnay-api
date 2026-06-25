import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { Public } from '../common/decorators/public-endpoint.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  findActive() {
    return this.categoriesService.findActive();
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  findAllForAdmin() {
    return this.categoriesService.findAllForAdmin();
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }
}
