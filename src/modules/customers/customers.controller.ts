import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/generated/prisma/enums';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@Roles(Role.CUSTOMER)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthJwtPayload) {
    return this.customersService.getProfile(user.sub);
  }

  @Post('profile')
  createProfile(@CurrentUser() user: AuthJwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.createProfile(user.sub, dto);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthJwtPayload, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateProfile(user.sub, dto);
  }
}
