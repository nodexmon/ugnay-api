import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@/generated/prisma/enums';
import { uploadConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';
import { PROTECTED_UPLOAD_SUBDIRS } from './uploads.constants';

@Injectable()
export class UploadsAssertions {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(uploadConfig.KEY)
    private readonly config: ConfigType<typeof uploadConfig>,
  ) {}

  async assertCanReadProtectedFile(
    user: AuthJwtPayload,
    filePath: string,
  ): Promise<void> {
    const subdir = filePath.split('/')[0];

    if (!PROTECTED_UPLOAD_SUBDIRS.has(subdir)) {
      throw new NotFoundException('File not found.');
    }

    const storedUrl = `${this.config.UPLOAD_DIR}/${filePath}`;

    const record = await this.findOwningRecord(subdir, storedUrl);

    if (!record) {
      throw new NotFoundException('File not found.');
    }

    if (user.role === Role.ADMIN) return;

    if (user.role !== Role.WORKER) {
      throw new ForbiddenException(
        'You do not have permission to access this file.',
      );
    }

    const worker = await this.prisma.workerProfile.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });

    if (!worker || worker.id !== record.workerId) {
      throw new ForbiddenException(
        'You do not have permission to access this file.',
      );
    }
  }

  // ─── Private: business logic ─────────────────────────────────────────────────

  private async findOwningRecord(
    subdir: string,
    storedUrl: string,
  ): Promise<{ workerId: string } | null> {
    if (subdir === 'verification') {
      return this.prisma.verificationDoc.findFirst({
        where: { OR: [{ idPhotoUrl: storedUrl }, { selfieUrl: storedUrl }] },
        select: { workerId: true },
      });
    }

    if (subdir === 'credentials') {
      return this.prisma.workerCredential.findFirst({
        where: { fileUrl: storedUrl },
        select: { workerId: true },
      });
    }

    return null;
  }
}
