import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Customer profile not found.');
    return profile;
  }

  async createProfile(userId: string, dto: CreateCustomerDto) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (existing)
      throw new ConflictException('Customer profile already exists.');

    return this.prisma.customerProfile.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl ?? null,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateCustomerDto) {
    await this.getProfile(userId);
    return this.prisma.customerProfile.update({
      where: { userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
      },
    });
  }
}
