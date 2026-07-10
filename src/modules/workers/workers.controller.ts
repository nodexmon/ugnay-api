import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { WorkersService } from '@/modules/workers/workers.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { CreateWorkerDto } from '@/modules/workers/dto/create-worker.dto';
import { UpdateWorkerDto } from '@/modules/workers/dto/update-worker.dto';
import { SetAvailabilityDto } from '@/modules/workers/dto/set-availability.dto';
import { SearchWorkersDto } from '@/modules/workers/dto/search-workers.dto';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { type UploadedVerificationFiles } from '@/modules/workers/workers.types';
import { VerificationFilesPipe } from '@/common/pipes/verification-files.pipe';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Public()
  @Get('search')
  search(@Query() query: SearchWorkersDto) {
    return this.workersService.search(query);
  }

  @CheckAbility(Action.Read, 'WorkerProfile')
  @Get('profile')
  getOwnProfile(@CurrentUser() user: AuthJwtPayload) {
    return this.workersService.findOwnProfile(user.sub);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workersService.findPublicProfile(id);
  }

  @CheckAbility(Action.Create, 'WorkerProfile')
  @Post('profile')
  createProfile(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateWorkerDto,
  ) {
    return this.workersService.createProfile(user.sub, dto);
  }

  @CheckAbility(Action.Update, 'WorkerProfile')
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpdateWorkerDto,
  ) {
    return this.workersService.updateProfile(user.sub, dto);
  }

  @CheckAbility(Action.Update, 'WorkerProfile')
  @Patch('availability')
  setAvailability(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.workersService.setAvailability(user.sub, dto.isOnline);
  }

  @CheckAbility(Action.Create, 'VerificationDoc')
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
    return this.workersService.submitVerification(user.sub, files);
  }
}
