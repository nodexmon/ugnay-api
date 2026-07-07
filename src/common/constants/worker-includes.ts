export const PUBLIC_WORKER_INCLUDE = {
  homeBarangay: true,
  categories: { include: { category: true } },
  serviceAreas: { include: { barangay: true } },
} as const;

export const WORKER_INCLUDE = {
  ...PUBLIC_WORKER_INCLUDE,
  verificationDocs: { orderBy: { createdAt: 'desc' as const } },
} as const;
