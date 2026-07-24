import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma/client';

type BarangayListItem = Prisma.BarangayGetPayload<{
  select: { id: true; name: true; centroidLat: true; centroidLng: true };
}>;

@Injectable()
export class BarangaysService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<BarangayListItem[]> {
    return this.prisma.barangay.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, centroidLat: true, centroidLng: true },
    });
  }
}
