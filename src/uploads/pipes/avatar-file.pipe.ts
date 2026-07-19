import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { AvatarFile } from '@/uploads/uploads.types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AvatarFilePipe implements PipeTransform {
  transform(file: AvatarFile): AvatarFile {
    if (!file) throw new BadRequestException('Avatar file is required.');

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Avatar file must be a JPEG, PNG, or WEBP image.',
      );
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Avatar file must not exceed 5 MB.');
    }

    return file;
  }
}
