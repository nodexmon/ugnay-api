import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/enums';
import { type AuthJwtPayload } from '../auth/jwt/jwt.service';
import { AdminService } from './admin.service';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('verifications')
  listPendingVerifications() {
    return this.adminService.listPendingVerifications();
  }

  @Patch('verifications/:id/approve')
  approveVerification(@CurrentUser() admin: AuthJwtPayload, @Param('id') id: string) {
    return this.adminService.approveVerification(id, admin.sub);
  }

  @Patch('verifications/:id/reject')
  rejectVerification(
    @CurrentUser() admin: AuthJwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.adminService.rejectVerification(id, admin.sub, dto.reason);
  }

  @Patch('users/:id/suspend')
  setUserSuspension(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.setUserSuspension(id, dto.suspended);
  }
}
