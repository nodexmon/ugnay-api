import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus } from '@/generated/prisma/enums';
import { User } from '@/generated/prisma/client';
import { assertUserExists } from '@/common/utils/assert.util';

@Injectable()
export class UsersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  assertUserExists(userId: string): Promise<User> {
    return assertUserExists(this.prisma, userId);
  }

  async assertUserIsActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('User account is not active.');
    return user;
  }
}
