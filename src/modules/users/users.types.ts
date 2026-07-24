import type { Prisma } from '@/generated/prisma/client';
import type { WORKER_INCLUDE } from '@/common/constants/worker-includes';

export type MeProfile = Prisma.UserGetPayload<{
  select: {
    id: true;
    phone: true;
    role: true;
    status: true;
    createdAt: true;
    updatedAt: true;
    workerProfile: { include: typeof WORKER_INCLUDE };
    customerProfile: true;
  };
}>;
