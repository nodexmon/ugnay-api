import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus } from '@/generated/prisma/enums';
import { User } from '@/generated/prisma/client';

@Injectable()
export class UsersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('User account is not active.');
    return user;
  }
}
