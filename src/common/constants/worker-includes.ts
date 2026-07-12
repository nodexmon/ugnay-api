export const PUBLIC_WORKER_INCLUDE = {
  homeBarangay: true,
  categories: { include: { category: true } },
  serviceAreas: { include: { barangay: true } },
  credentials: {
    where: { status: 'APPROVED' as const },
    select: { type: true },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

export const WORKER_INCLUDE = {
  ...PUBLIC_WORKER_INCLUDE,
  verificationDocs: { orderBy: { createdAt: 'desc' as const } },
  credentials: { orderBy: { createdAt: 'desc' as const } },
} as const;
