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
import { mkdir, readFile, writeFile } from 'fs/promises';
import { extname, join, normalize, posix, sep } from 'path';
import { randomUUID } from 'crypto';
import type { AvatarFile } from './uploads.types';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';
import { UploadsAssertions } from './uploads.assertions';
import { FileCryptoService } from '@/common/services/file-crypto.service';

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
    private readonly crypto: FileCryptoService,
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
    const absoluteDir = join(this.config.UPLOAD_ROOT, 'avatars');
    const avatarUrl = `${this.config.UPLOAD_DIR}/avatars/${filename}`;

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
    const avatarsRoot = join(this.config.UPLOAD_ROOT, 'avatars');
    return this.streamFromDisk(safe, avatarsRoot);
  }

  async serveProtectedFile(
    user: AuthJwtPayload,
    filePath: string,
  ): Promise<StreamableFile> {
    const normalized = this.normalizeRelativePath(filePath);
    await this.assertions.assertCanReadProtectedFile(user, normalized);

    return this.readDecrypted(normalized, this.config.UPLOAD_ROOT);
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
    const absolutePath = this.resolveWithinRoot(relativePath, requiredRoot);

    const ext = extname(absolutePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
    });
  }

  // Protected files are encrypted at rest, so they are read into memory (≤5 MB)
  // and decrypted before streaming. Legacy plaintext passes through untouched.
  private async readDecrypted(
    relativePath: string,
    requiredRoot: string,
  ): Promise<StreamableFile> {
    const absolutePath = this.resolveWithinRoot(relativePath, requiredRoot);

    const contents = this.crypto.decrypt(await readFile(absolutePath));

    const ext = extname(absolutePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new StreamableFile(contents, { type: mimeType });
  }

  private resolveWithinRoot(
    relativePath: string,
    requiredRoot: string,
  ): string {
    const absolutePath = normalize(join(requiredRoot, relativePath));

    if (!absolutePath.startsWith(requiredRoot + sep)) {
      throw new NotFoundException('File not found.');
    }

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found.');
    }

    return absolutePath;
  }
}
