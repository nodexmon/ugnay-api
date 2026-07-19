import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from '@/modules/users/users.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @CheckAbility(Action.Read, 'User')
  @Get('me')
  getMe(@CurrentUser() user: AuthJwtPayload) {
    return this.usersService.findMe(user.sub);
  }
}
