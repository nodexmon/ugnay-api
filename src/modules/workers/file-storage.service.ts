import { Inject, Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { ConfigType } from '@nestjs/config';
import { uploadConfig } from '@/config';
import type { FileMetadata } from '@/modules/workers/workers.types';

export interface FilePaths {
  relative: string;
  absolute: string;
  dir: string;
}

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(uploadConfig.KEY)
    private readonly config: ConfigType<typeof uploadConfig>,
  ) {}

  resolvePath(workerId: string, kind: string, file: FileMetadata, subdir = 'verification'): FilePaths {
    const uploadRoot = this.config.UPLOAD_DIR;
    const relativeDir = join(subdir, workerId);
    const extension = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${kind}-${randomUUID()}${extension}`;
    const relative = join(uploadRoot, relativeDir, filename).replace(
      /\\/g,
      '/',
    );
    const absolute = join(
      __dirname,
      '..',
      '..',
      uploadRoot,
      relativeDir,
      filename,
    );
    return {
      relative,
      absolute,
      dir: join(__dirname, '..', '..', uploadRoot, relativeDir),
    };
  }

  async write(paths: FilePaths, file: FileMetadata): Promise<void> {
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.absolute, file.buffer);
  }
}
