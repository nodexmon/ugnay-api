import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @CheckAbility(Action.Read, 'CustomerProfile')
  @Get('profile')
  getProfile(@CurrentUser() user: AuthJwtPayload) {
    return this.customersService.getProfile(user.sub);
  }

  @CheckAbility(Action.Create, 'CustomerProfile')
  @Post('profile')
  createProfile(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createProfile(user.sub, dto);
  }

  @CheckAbility(Action.Update, 'CustomerProfile')
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateProfile(user.sub, dto);
  }
}
