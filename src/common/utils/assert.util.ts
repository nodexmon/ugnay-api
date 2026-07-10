import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';

export async function assertUserIsActive(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenException('Active user is required.');
  }
  return user;
}
