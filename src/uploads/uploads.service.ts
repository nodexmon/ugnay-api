import {
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@/generated/prisma/enums';
import { uploadConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, normalize, posix, sep } from 'path';
import { randomUUID } from 'crypto';
import type { AvatarFile } from './uploads.types';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';
import { UploadsAssertions } from './uploads.assertions';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: UploadsAssertions,
    @Inject(uploadConfig.KEY)
    private readonly config: ConfigType<typeof uploadConfig>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async uploadAvatar(
    userId: string,
    role: Role,
    file: AvatarFile,
  ): Promise<{ avatarUrl: string }> {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const uploadRoot = this.config.UPLOAD_DIR;
    const absoluteDir = join(process.cwd(), uploadRoot, 'avatars');
    const avatarUrl = `${uploadRoot}/avatars/${filename}`;

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, filename), file.buffer);

    if (role === Role.WORKER) {
      await this.prisma.workerProfile.update({
        where: { userId },
        data: { avatarUrl },
      });
    } else {
      await this.prisma.customerProfile.update({
        where: { userId },
        data: { avatarUrl },
      });
    }

    return { avatarUrl };
  }

  serveAvatar(filePath: string): StreamableFile {
    const safe = this.normalizeRelativePath(filePath);
    const avatarsRoot = join(process.cwd(), this.config.UPLOAD_DIR, 'avatars');
    return this.streamFromDisk(safe, avatarsRoot);
  }

  async serveProtectedFile(
    user: AuthJwtPayload,
    filePath: string,
  ): Promise<StreamableFile> {
    const normalized = this.normalizeRelativePath(filePath);
    await this.assertions.assertCanReadProtectedFile(user, normalized);

    const uploadRoot = join(process.cwd(), this.config.UPLOAD_DIR);
    return this.streamFromDisk(normalized, uploadRoot);
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private normalizeRelativePath(filePath: string): string {
    const normalized = posix.normalize(filePath.replace(/\\/g, '/'));

    if (normalized.startsWith('..') || posix.isAbsolute(normalized)) {
      throw new NotFoundException('File not found.');
    }

    return normalized;
  }

  private streamFromDisk(
    relativePath: string,
    requiredRoot: string,
  ): StreamableFile {
    const absolutePath = normalize(join(requiredRoot, relativePath));

    if (!absolutePath.startsWith(requiredRoot + sep)) {
      throw new NotFoundException('File not found.');
    }

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found.');
    }

    const ext = extname(absolutePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
    });
  }
}
