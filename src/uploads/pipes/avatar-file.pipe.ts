import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import type { AvatarFile } from '@/uploads/uploads.types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AvatarFilePipe implements PipeTransform {
  async transform(file: AvatarFile): Promise<AvatarFile> {
    if (!file) {
      throw new BadRequestException('Avatar file is required.');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Avatar file must be a JPEG, PNG, or WEBP image.',
      );
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Avatar file must not exceed 5 MB.');
    }

    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
      throw new BadRequestException(
        'Avatar file content does not match the declared type.',
      );
    }

    return file;
  }
}
