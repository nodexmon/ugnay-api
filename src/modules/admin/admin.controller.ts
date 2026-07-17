import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from '@/modules/admin/admin.service';
import { RejectVerificationDto } from '@/modules/admin/dto/reject-verification.dto';
import { SuspendUserDto } from '@/modules/admin/dto/suspend-user.dto';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('admin')
@ApiBearerAuth()
@CheckAbility(Action.Manage, 'all')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Get('workers')
  listWorkers(@Query() query: ListWorkersQueryDto) {
    return this.adminService.findWorkers(query);
  }

  @Get('bookings')
  listBookings(@Query() query: ListBookingsQueryDto) {
    return this.adminService.findBookings(query);
  }

  @Get('verifications')
  listPendingVerifications(@Query() query: PaginationDto) {
    return this.adminService.findPendingVerifications(query);
  }

  @Patch('verifications/:id/approve')
  approveVerification(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.approveVerification(id, user);
  }

  @Patch('verifications/:id/reject')
  rejectVerification(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.adminService.rejectVerification(id, user, dto.reason);
  }

  @Get('credentials')
  listPendingCredentials(@Query() query: PaginationDto) {
    return this.adminService.findPendingCredentials(query);
  }

  @Patch('credentials/:id/approve')
  approveCredential(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.approveCredential(id, user);
  }

  @Patch('credentials/:id/reject')
  rejectCredential(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.adminService.rejectCredential(id, user, dto.reason);
  }

  @Patch('users/:id/suspend')
  setUserSuspension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.setUserSuspension(id, dto.suspended);
  }

  @Post('barangays/sync')
  syncBarangays() {
    return this.adminService.syncBarangays();
  }

  @Post('strikes')
  strikeWorker(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: StrikeWorkerDto,
  ) {
    return this.adminService.strikeWorker(user, dto);
  }

  @Get('no-shows')
  listPendingNoShows(@Query() query: PaginationDto) {
    return this.adminService.findPendingNoShows(query);
  }

  @Patch('no-shows/:id/resolve')
  resolveNoShow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveNoShowDto,
  ) {
    return this.adminService.resolveNoShow(id, user, dto);
  }
}
