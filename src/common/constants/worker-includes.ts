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

export const ADMIN_WORKER_INCLUDE = {
  ...WORKER_INCLUDE,
  user: { select: { id: true, phone: true, status: true } },
} as const;
