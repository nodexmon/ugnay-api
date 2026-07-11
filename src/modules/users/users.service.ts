import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        workerProfile: {
          include: {
            homeBarangay: true,
            categories: { include: { category: true } },
            serviceAreas: { include: { barangay: true } },
          },
        },
        customerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }
}
