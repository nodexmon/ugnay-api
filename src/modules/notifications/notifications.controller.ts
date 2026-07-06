import { Body, Controller, Delete, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { RemovePushTokenDto } from './dto/remove-push-token.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-token')
  registerToken(@CurrentUser() user: AuthJwtPayload, @Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerToken(user.sub, dto.token, dto.platform);
  }

  @Delete('push-token')
  removeToken(@CurrentUser() user: AuthJwtPayload, @Body() dto: RemovePushTokenDto) {
    return this.notificationsService.removeToken(user.sub, dto.token);
  }
}
