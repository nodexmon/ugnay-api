import type { Prisma } from '@/generated/prisma/client';

export type BarangayListItem = Prisma.BarangayGetPayload<{
  select: { id: true; name: true; centroidLat: true; centroidLng: true };
}>;

export interface PsgcBarangay {
  code: string;
  name: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  total: number;
}
