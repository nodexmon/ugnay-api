import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { SkipAbilityCheck } from '@/common/decorators/skip-ability-check.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { AvatarFilePipe } from './pipes/avatar-file.pipe';
import { multerConfig } from '@/config/multer.config';
import type { AvatarFile } from './uploads.types';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Public()
  @Get('avatars/*path')
  serveAvatar(@Param('path') path: string) {
    return this.uploadsService.serveAvatar(path);
  }

  @SkipAbilityCheck()
  @Get('*path')
  serveProtectedFile(
    @CurrentUser() user: AuthJwtPayload,
    @Param('path') path: string,
  ) {
    return this.uploadsService.serveProtectedFile(user, path);
  }

  @SkipAbilityCheck()
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  uploadAvatar(
    @CurrentUser() user: AuthJwtPayload,
    @UploadedFile(AvatarFilePipe) file: AvatarFile,
  ) {
    return this.uploadsService.uploadAvatar(user.sub, user.role, file);
  }
}
