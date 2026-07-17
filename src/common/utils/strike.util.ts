import { ConflictException } from '@nestjs/common';
import { StrikeReason, WorkerStatus } from '@/generated/prisma/enums';
import { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';
import type { WorkerProfile } from '@/generated/prisma/client';
import { STRIKE_SUSPENSION_THRESHOLD } from '@/modules/admin/admin.constants';

export async function applyStrike(
  tx: TransactionClient,
  workerId: string,
  data: {
    bookingId?: string;
    reason: StrikeReason;
    issuedBy: string;
    notes?: string;
  },
): Promise<WorkerProfile> {
  if (data.bookingId) {
    const existing = await tx.strike.findUnique({
      where: { bookingId: data.bookingId },
    });
    if (existing) {
      throw new ConflictException(
        'This booking has already been used for a strike.',
      );
    }
  }

  await tx.strike.create({ data: { workerId, ...data } });

  const updated = await tx.workerProfile.update({
    where: { id: workerId },
    data: { strikeCount: { increment: 1 } },
  });

  if (updated.strikeCount >= STRIKE_SUSPENSION_THRESHOLD) {
    return tx.workerProfile.update({
      where: { id: updated.id },
      data: { status: WorkerStatus.SUSPENDED, isOnline: false },
    });
  }

  return updated;
}
