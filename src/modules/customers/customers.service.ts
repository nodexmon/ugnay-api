import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersAssertions } from './customers.assertions';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: CustomersAssertions,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async findProfile(userId: string) {
    return this.assertions.findCustomerProfile(userId);
  }

  async createProfile(userId: string, dto: CreateCustomerDto) {
    await this.assertions.assertCustomerProfileDoesNotExist(userId);

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
    await this.assertions.findCustomerProfile(userId);
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
