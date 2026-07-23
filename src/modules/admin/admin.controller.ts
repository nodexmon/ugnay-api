import {
  Body,
  Controller,
  Delete,
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
import { CreateAdminDto } from '@/modules/admin/dto/create-admin.dto';
import { SuspendUserDto } from '@/modules/admin/dto/suspend-user.dto';
import { StrikeWorkerDto } from './dto/strike-worker.dto';
import { ResolveNoShowDto } from './dto/resolve-no-show.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { FindWorkersQueryDto } from './dto/find-workers-query.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { FindReviewsAdminQueryDto } from './dto/find-reviews-admin-query.dto';
import { ReinstateWorkerDto } from './dto/reinstate-worker.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('admin')
@ApiBearerAuth()
@CheckAbility(Action.Manage, 'all')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: FindUsersQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Get('workers')
  listWorkers(@Query() query: FindWorkersQueryDto) {
    return this.adminService.findWorkers(query);
  }

  @Get('bookings')
  listBookings(@Query() query: FindBookingsQueryDto) {
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

  @Post('admins')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Patch('users/:id/suspend')
  setUserSuspension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.setUserSuspension(id, dto.suspended);
  }

  @Patch('workers/:id/reinstate')
  reinstateWorker(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReinstateWorkerDto,
  ) {
    return this.adminService.reinstateWorker(id, dto, user);
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

  @Get('customer-no-shows')
  listPendingCustomerNoShows(@Query() query: PaginationDto) {
    return this.adminService.findPendingCustomerNoShows(query);
  }

  @Patch('customer-no-shows/:id/resolve')
  resolveCustomerNoShow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveNoShowDto,
  ) {
    return this.adminService.resolveCustomerNoShow(id, user, dto);
  }

  @Get('reviews')
  listReviews(@Query() query: FindReviewsAdminQueryDto) {
    return this.adminService.findAllReviews(query);
  }

  @Delete('reviews/:id')
  deleteReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteReview(id);
  }
}
