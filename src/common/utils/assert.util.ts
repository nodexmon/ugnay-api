import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';

type HttpExceptionConstructor = new (message: string) => Error;

export async function assertExists<T>(
  finder: () => Promise<T | null>,
  errorMessage: string,
  Exception: HttpExceptionConstructor = NotFoundException,
): Promise<T> {
  const entity = await finder();
  if (!entity) throw new Exception(errorMessage);
  return entity;
}

export async function assertUserIsActive(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenException('Active user is required.');
  }
  return user;
}
