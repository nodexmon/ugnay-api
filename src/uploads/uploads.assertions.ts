import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@/generated/prisma/enums';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';
import { PROTECTED_UPLOAD_SUBDIRS } from './uploads.constants';

@Injectable()
export class UploadsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanReadProtectedFile(
    user: AuthJwtPayload,
    filePath: string,
  ): Promise<void> {
    const [subdir, workerId] = filePath.split('/');

    if (!PROTECTED_UPLOAD_SUBDIRS.has(subdir) || !workerId) {
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

    if (!worker || worker.id !== workerId) {
      throw new ForbiddenException(
        'You do not have permission to access this file.',
      );
    }
  }
}
