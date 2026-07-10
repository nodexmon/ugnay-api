import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public-endpoint.decorator';
import { type AuthJwtPayload } from '@/modules/auth/auth.types';
import { AvatarFilePipe } from './pipes/avatar-file.pipe';
import { multerConfig } from '@/config/multer.config';
import type { AvatarFile } from './uploads.types';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Public()
  @Get('*path')
  serveFile(@Param('path') path: string) {
    return this.uploadsService.serveFile(path);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  uploadAvatar(
    @CurrentUser() user: AuthJwtPayload,
    @UploadedFile(AvatarFilePipe) file: AvatarFile,
  ) {
    return this.uploadsService.uploadAvatar(user.sub, user.role, file);
  }
}
