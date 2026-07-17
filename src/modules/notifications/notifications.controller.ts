import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { RemovePushTokenDto } from './dto/remove-push-token.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @CheckAbility(Action.Create, 'PushToken')
  @Post('push-token')
  registerToken(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerToken(
      user.sub,
      dto.token,
      dto.platform,
    );
  }

  @CheckAbility(Action.Delete, 'PushToken')
  @Delete('push-token')
  removeToken(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: RemovePushTokenDto,
  ) {
    return this.notificationsService.removeToken(user.sub, dto.token);
  }
}
