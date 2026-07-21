import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthJwtPayload } from '../auth/auth.types';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ReportNoShowDto } from './dto/report-no-show.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @CheckAbility(Action.Create, 'Booking')
  @Post()
  create(@CurrentUser() user: AuthJwtPayload, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user, dto);
  }

  @CheckAbility(Action.Read, 'Booking')
  @Get()
  findMany(
    @CurrentUser() user: AuthJwtPayload,
    @Query() query: FindBookingsQueryDto,
  ) {
    return this.bookingsService.findMany(user, query);
  }

  @CheckAbility(Action.Read, 'Booking')
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findOne(id, user);
  }

  @CheckAbility(Action.Update, 'Booking')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, user, dto);
  }

  @CheckAbility(Action.Accept, 'Booking')
  @Patch(':id/accept')
  accept(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.accept(id, user);
  }

  @CheckAbility(Action.Reject, 'Booking')
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.reject(id, user);
  }

  @CheckAbility(Action.Start, 'Booking')
  @Patch(':id/start')
  start(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.start(id, user);
  }

  @CheckAbility(Action.Complete, 'Booking')
  @Patch(':id/complete')
  complete(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.complete(id, user);
  }

  @CheckAbility(Action.Cancel, 'Booking')
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user, dto);
  }

  @CheckAbility(Action.ReportNoShow, 'Booking')
  @Patch(':id/report-no-show')
  reportNoShow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportNoShowDto,
  ) {
    return this.bookingsService.reportNoShow(id, user, dto.description);
  }

  @CheckAbility(Action.ReportCustomerNoShow, 'Booking')
  @Patch(':id/report-customer-no-show')
  reportCustomerNoShow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportNoShowDto,
  ) {
    return this.bookingsService.reportCustomerNoShow(id, user, dto.description);
  }
}
