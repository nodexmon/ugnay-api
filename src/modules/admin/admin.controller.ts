import { Body, Controller, Get, Post, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { AdminService } from '@/modules/admin/admin.service';
import { RejectVerificationDto } from '@/modules/admin/dto/reject-verification.dto';
import { SuspendUserDto } from '@/modules/admin/dto/suspend-user.dto';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';

@CheckAbility(Action.Manage, 'all')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('verifications')
  listPendingVerifications(@CurrentUser() user: AuthJwtPayload) {
    return this.adminService.findPendingVerifications(user);
  }

  @Patch('verifications/:id/approve')
  approveVerification(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
    return this.adminService.approveVerification(id, user);
  }

  @Patch('verifications/:id/reject')
  rejectVerification(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.adminService.rejectVerification(id, user, dto.reason);
  }

  @Patch('users/:id/suspend')
  setUserSuspension(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.setUserSuspension(user, id, dto.suspended);
  }

  @Post('strikes')
  strikeWorker(@CurrentUser() user: AuthJwtPayload, @Body() dto: StrikeWorkerDto) {
    return this.adminService.strikeWorker(user, dto);
  }

  @Get('no-shows')
  listPendingNoShows(@CurrentUser() user: AuthJwtPayload) {
    return this.adminService.findPendingNoShows(user);
  }

  @Patch('no-shows/:id/resolve')
  resolveNoShow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolveNoShowDto,
  ) {
    return this.adminService.resolveNoShow(id, user, dto);
  }
}
