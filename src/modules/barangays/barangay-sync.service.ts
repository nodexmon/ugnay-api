import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import { psgcConfig } from '@/config/psgc.config';
import { PrismaService } from '@/prisma/prisma.service';

interface PsgcBarangay {
  code: string;
  name: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  total: number;
}

@Injectable()
export class BarangaySyncService {
  constructor(
    @Inject(psgcConfig.KEY)
    private readonly config: ConfigType<typeof psgcConfig>,
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async syncBarangays(): Promise<SyncResult> {
    const fetched = await this.fetchFromPsgc();
    const fetchedCodes = new Set(fetched.map((b) => b.code));

    let created = 0;
    let updated = 0;

    for (const { code, name } of fetched) {
      const existing = await this.prisma.barangay.findFirst({
        where: { OR: [{ psgcCode: code }, { name }] },
      });

      if (existing) {
        await this.prisma.barangay.update({
          where: { id: existing.id },
          data: { psgcCode: code, name, isActive: true },
        });
        updated++;
      } else {
        await this.prisma.barangay.create({
          data: { psgcCode: code, name, isActive: true },
        });
        created++;
      }
    }

    const { count: deactivated } = await this.prisma.barangay.updateMany({
      where: {
        isActive: true,
        psgcCode: { notIn: [...fetchedCodes], not: null },
      },
      data: { isActive: false },
    });

    this.logger.log(
      { created, updated, deactivated },
      'Barangay sync complete',
    );

    return { created, updated, deactivated, total: fetched.length };
  }

  // ─── Private: business logic ──────────────────────────────────────────────────

  private async fetchFromPsgc(): Promise<PsgcBarangay[]> {
    const { apiUrl, calapanCityCode } = this.config;
    const url = `${apiUrl}/cities-municipalities/${calapanCityCode}/barangays.json`;

    try {
      const response = await firstValueFrom(
        this.http.get<PsgcBarangay[]>(url),
      );
      return response.data;
    } catch (err: unknown) {
      this.logger.error({ err }, 'Failed to fetch barangays from PSGC API');
      throw new InternalServerErrorException(
        'Failed to fetch barangays from PSGC API.',
      );
    }
  }
}
