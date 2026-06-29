import { Body, Controller, Get, Post, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/generated/prisma/enums';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { AdminService } from '@/modules/admin/admin.service';
import { RejectVerificationDto } from '@/modules/admin/dto/reject-verification.dto';
import { SuspendUserDto } from '@/modules/admin/dto/suspend-user.dto';
import { StrikeWorkerDto } from './dto/strike-worker.dto';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('verifications')
  listPendingVerifications(@CurrentUser() user: AuthJwtPayload) {
    return this.adminService.findPendingVerifications(user);
  }

  @Patch('verifications/:id/approve')
  approveVerification(
    @CurrentUser() user: AuthJwtPayload, 
    @Param('id') id: string
  ) {
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
    @Body() dto: SuspendUserDto
  ) {
    return this.adminService.setUserSuspension(user, id, dto.suspended);
  }
  
  @Post('strikes')
  strikeWorker(
    @CurrentUser() user: AuthJwtPayload, 
    @Body() dto: StrikeWorkerDto
  ) {
    return this.adminService.strikeWorker(user, dto)
  }
}
