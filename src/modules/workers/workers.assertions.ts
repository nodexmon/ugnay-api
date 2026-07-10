import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WorkersAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async assertProfileDoesNotExist(userId: string): Promise<void> {
    const existing = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Worker profile already exists');
  }

  assertUnique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`Duplicate ${label} are not allowed`);
    }
  }
}
