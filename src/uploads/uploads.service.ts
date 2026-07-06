import { Inject, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@/generated/prisma/enums';
import { uploadConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { randomUUID } from 'crypto';
import type { AvatarFile } from './uploads.types';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(uploadConfig.KEY) private readonly config: ConfigType<typeof uploadConfig>,
  ) {}

  async uploadAvatar(userId: string, role: Role, file: AvatarFile): Promise<{ avatarUrl: string }> {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const uploadRoot = this.config.UPLOAD_DIR;
    const absoluteDir = join(process.cwd(), uploadRoot, 'avatars');
    const avatarUrl = `${uploadRoot}/avatars/${filename}`;

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, filename), file.buffer);

    if (role === Role.WORKER) {
      await this.prisma.workerProfile.update({ where: { userId }, data: { avatarUrl } });
    } else {
      await this.prisma.customerProfile.update({ where: { userId }, data: { avatarUrl } });
    }

    return { avatarUrl };
  }

  serveFile(filePath: string): StreamableFile {
    const uploadRoot = join(process.cwd(), this.config.UPLOAD_DIR);
    const normalized = normalize(join(uploadRoot, filePath));

    if (!normalized.startsWith(uploadRoot)) {
      throw new NotFoundException('File not found.');
    }

    if (!existsSync(normalized)) {
      throw new NotFoundException('File not found.');
    }

    const ext = extname(normalized).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new StreamableFile(createReadStream(normalized), { type: mimeType });
  }
}
