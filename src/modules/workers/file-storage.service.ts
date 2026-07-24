import { Inject, Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, posix } from 'path';
import { randomUUID } from 'crypto';
import type { ConfigType } from '@nestjs/config';
import { uploadConfig } from '@/config';
import { FileCryptoService } from '@/common/services/file-crypto.service';
import type { FileMetadata, FilePaths } from '@/modules/workers/workers.types';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(uploadConfig.KEY)
    private readonly config: ConfigType<typeof uploadConfig>,
    private readonly crypto: FileCryptoService,
  ) {}

  resolvePath(
    workerId: string,
    kind: string,
    file: FileMetadata,
    subdir = 'verification',
  ): FilePaths {
    const extension = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${kind}-${randomUUID()}${extension}`;
    // Stored URL keeps the logical UPLOAD_DIR prefix (forward slashes); the
    // physical path is anchored to the absolute UPLOAD_ROOT.
    const relative = posix.join(
      this.config.UPLOAD_DIR,
      subdir,
      workerId,
      filename,
    );
    const dir = join(this.config.UPLOAD_ROOT, subdir, workerId);
    return {
      relative,
      absolute: join(dir, filename),
      dir,
    };
  }

  async write(paths: FilePaths, file: FileMetadata): Promise<void> {
    // Everything written here (verification IDs/selfies, credentials) is PII —
    // encrypt at rest. Avatars are written by UploadsService and stay plaintext.
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.absolute, this.crypto.encrypt(file.buffer));
  }
}
