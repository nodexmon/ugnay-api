import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { WorkersService } from './workers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SearchWorkersDto } from './dto/search-workers.dto';
import { type AuthJwtPayload } from '../auth/auth.types';
import { type UploadedVerificationFiles } from './workers.types';
import { VerificationFilesPipe } from '../../common/pipes/verification-files.pipe';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('search')
  search(@Query() query: SearchWorkersDto) {
    return this.workersService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workersService.findPublicProfile(id);
  }

  @Post('profile')
  createProfile(@CurrentUser() user: AuthJwtPayload, @Body() dto: CreateWorkerDto) {
    return this.workersService.createProfile(user.sub, user.role, dto);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthJwtPayload, @Body() dto: UpdateWorkerDto) {
    return this.workersService.updateProfile(user.sub, user.role, dto);
  }

  @Patch('availability')
  setAvailability(@CurrentUser() user: AuthJwtPayload, @Body() dto: SetAvailabilityDto) {
    return this.workersService.setAvailability(user.sub, user.role, dto.isOnline);
  }

  @Post('verification')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'idPhoto', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  submitVerification(
    @CurrentUser() user: AuthJwtPayload,
    @UploadedFiles(VerificationFilesPipe) files: UploadedVerificationFiles,
  ) {
    return this.workersService.submitVerification(user.sub, user.role, files);
  }
}
