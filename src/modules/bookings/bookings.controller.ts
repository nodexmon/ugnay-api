import { Body, Controller, Post, Get, Query, Param, Patch } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Role } from '@/generated/prisma/enums';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthJwtPayload } from '../auth/auth.types';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ReportNoShowDto } from './dto/report-no-show.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  create(@CurrentUser() user: AuthJwtPayload, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user, dto)
  }

  @Get()
  findMany(@CurrentUser() user: AuthJwtPayload, @Query() query: FindBookingsQueryDto) {
    return this.bookingsService.findMany(user, query)
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
    return this.bookingsService.findOne(id, user)
  }

  @Patch(':id/update')
  @Roles(Role.CUSTOMER)
  update(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, user, dto)
  }

  @Patch(':id/accept')
  @Roles(Role.WORKER)
  accept(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
      return this.bookingsService.accept(id, user)
  }

  @Patch(':id/reject')
  @Roles(Role.WORKER)
  reject(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
      return this.bookingsService.reject(id, user)
  }

  @Patch(':id/start')
  @Roles(Role.WORKER)
  start(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
      return this.bookingsService.start(id, user)
  }

  @Patch(':id/complete')
  @Roles(Role.WORKER)
  complete(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string) {
      return this.bookingsService.complete(id, user)
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string, @Body() dto: CancelBookingDto) {
      return this.bookingsService.cancel(id, user, dto)
  }

  @Post(':id/no-show')
  @Roles(Role.CUSTOMER)
  reportNoShow(@CurrentUser() user: AuthJwtPayload, @Param('id') id: string, @Body() dto: ReportNoShowDto) {
      return this.bookingsService.reportNoShow(id, user, dto.description)
  }

}
