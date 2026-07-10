import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@/generated/prisma/client';

@Injectable()
export class UsersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertUserExists(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User does not exist.');
    return user;
  }
}
