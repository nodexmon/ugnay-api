import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomerProfile } from '@/generated/prisma/client';

@Injectable()
export class CustomersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async findCustomerProfile(userId: string): Promise<CustomerProfile> {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Customer profile not found.');
    return profile;
  }

  async assertCustomerProfileDoesNotExist(userId: string): Promise<void> {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('Customer profile already exists.');
  }
}
