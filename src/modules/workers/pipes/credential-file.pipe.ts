import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import type { AvatarFile } from '@/uploads/uploads.types';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class CredentialFilePipe implements PipeTransform {
  async transform(file: AvatarFile): Promise<AvatarFile> {
    if (!file) {
      throw new BadRequestException('Credential file is required.');
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Credential file must be a JPEG, PNG, WEBP image, or PDF.',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Credential file must not exceed 5 MB.');
    }
    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
      throw new BadRequestException(
        'Credential file content does not match the declared type.',
      );
    }
    return file;
  }
}
