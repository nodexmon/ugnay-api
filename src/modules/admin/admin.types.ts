import type { Prisma } from '@/generated/prisma/client';
import type {
  ADMIN_WORKER_INCLUDE,
  WORKER_INCLUDE,
} from '@/common/constants/worker-includes';

export type PendingVerification = Prisma.VerificationDocGetPayload<{
  include: { worker: { include: typeof ADMIN_WORKER_INCLUDE } };
}>;

export type PendingCredential = Prisma.WorkerCredentialGetPayload<{
  include: { worker: { include: typeof ADMIN_WORKER_INCLUDE } };
}>;

export type WorkerWithRelations = Prisma.WorkerProfileGetPayload<{
  include: typeof WORKER_INCLUDE;
}>;

export type PendingNoShow = Prisma.NoShowReportGetPayload<{
  include: {
    booking: {
      include: {
        worker: {
          select: { id: true; firstName: true; lastName: true; userId: true };
        };
        customer: { select: { firstName: true; lastName: true } };
        category: { select: { name: true } };
      };
    };
  };
}>;

export type PendingCustomerNoShow = Prisma.NoShowReportGetPayload<{
  include: {
    booking: {
      include: {
        worker: { select: { id: true; firstName: true; lastName: true } };
        customer: {
          select: { firstName: true; lastName: true; userId: true };
        };
        category: { select: { name: true } };
      };
    };
  };
}>;

export type AdminUserListItem = Prisma.UserGetPayload<{
  select: { id: true; phone: true; role: true; status: true; createdAt: true };
}>;

export type AdminWorkerListItem = Prisma.WorkerProfileGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    status: true;
    strikeCount: true;
    averageRating: true;
    totalJobsCompleted: true;
    createdAt: true;
    user: { select: { phone: true } };
  };
}>;

export type AdminBookingListItem = Prisma.BookingGetPayload<{
  select: {
    id: true;
    status: true;
    scheduledDate: true;
    createdAt: true;
    worker: { select: { firstName: true; lastName: true } };
    customer: { select: { firstName: true; lastName: true } };
    category: { select: { name: true } };
  };
}>;

export type AdminReviewListItem = Prisma.ReviewGetPayload<{
  include: {
    worker: { select: { firstName: true; lastName: true } };
    customer: { select: { firstName: true; lastName: true } };
  };
}>;

export interface NoShowResolution {
  resolved: boolean;
  confirmed: boolean;
}
