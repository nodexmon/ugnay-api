import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersAssertions } from './customers.assertions';
import type { CustomerProfile } from '@/generated/prisma/client';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: CustomersAssertions,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async findProfile(userId: string): Promise<CustomerProfile> {
    return this.assertions.findCustomerProfile(userId);
  }

  async createProfile(
    userId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerProfile> {
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

  async updateProfile(
    userId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerProfile> {
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
