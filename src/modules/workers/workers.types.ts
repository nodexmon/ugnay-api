import type { Prisma } from '@/generated/prisma/client';
import type {
  PUBLIC_WORKER_INCLUDE,
  WORKER_INCLUDE,
} from '@/common/constants/worker-includes';

type VerificationFilesMetadata = FileMetadata & {
  mimetype: string;
};

export interface FileMetadata {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface UploadedVerificationFiles {
  idPhoto: VerificationFilesMetadata[];
  selfie: VerificationFilesMetadata[];
}

export interface FilePaths {
  relative: string;
  absolute: string;
  dir: string;
}

export type WorkerWithRelations = Prisma.WorkerProfileGetPayload<{
  include: typeof WORKER_INCLUDE;
}>;

// `averageRating` is hidden (null) until the worker crosses the public-rating
// review threshold, so it widens the model's non-null Decimal to `Decimal | null`.
export type PublicWorkerListItem = Omit<
  Prisma.WorkerProfileGetPayload<{ include: typeof PUBLIC_WORKER_INCLUDE }>,
  'averageRating'
> & { averageRating: Prisma.Decimal | null };
