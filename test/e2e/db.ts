import { PrismaService } from '@/prisma/prisma.service';
import {
  BookingStatus,
  BookingType,
  Role,
  TimeWindow,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '@/generated/prisma/enums';

export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
  );
}

export async function createBarangay(
  prisma: PrismaService,
  overrides: { name?: string } = {},
) {
  return prisma.barangay.create({
    data: {
      name: overrides.name ?? `Barangay-${Date.now()}`,
      centroidLat: 14.5,
      centroidLng: 121.0,
    },
  });
}

export async function createCategory(
  prisma: PrismaService,
  overrides: { name?: string; slug?: string } = {},
) {
  const suffix = Date.now();
  return prisma.serviceCategory.create({
    data: {
      name: overrides.name ?? `Category-${suffix}`,
      slug: overrides.slug ?? `category-${suffix}`,
    },
  });
}

export async function createUser(
  prisma: PrismaService,
  overrides: { phone?: string; role?: Role; status?: UserStatus } = {},
) {
  return prisma.user.create({
    data: {
      phone:
        overrides.phone ??
        `+639${Math.floor(100000000 + Math.random() * 900000000)}`,
      role: overrides.role ?? Role.CUSTOMER,
      status: overrides.status ?? UserStatus.ACTIVE,
    },
  });
}

export async function createCustomer(
  prisma: PrismaService,
  overrides: { phone?: string; status?: UserStatus } = {},
) {
  const user = await createUser(prisma, { role: Role.CUSTOMER, ...overrides });
  const profile = await prisma.customerProfile.create({
    data: { userId: user.id, firstName: 'Test', lastName: 'Customer' },
  });
  return { user, profile };
}

export async function createWorker(
  prisma: PrismaService,
  barangayId: string,
  overrides: {
    status?: WorkerStatus;
    strikeCount?: number;
    phone?: string;
  } = {},
) {
  const user = await createUser(prisma, {
    role: Role.WORKER,
    phone: overrides.phone,
  });
  const profile = await prisma.workerProfile.create({
    data: {
      userId: user.id,
      firstName: 'Test',
      lastName: 'Worker',
      baseRate: 300,
      homeBarangayId: barangayId,
      status: overrides.status ?? WorkerStatus.VERIFIED,
      strikeCount: overrides.strikeCount ?? 0,
    },
  });
  return { user, profile };
}

export async function createAdmin(prisma: PrismaService) {
  return createUser(prisma, { role: Role.ADMIN });
}

export async function createBooking(
  prisma: PrismaService,
  opts: {
    customerId: string;
    workerId: string;
    categoryId: string;
    barangayId: string;
    status?: BookingStatus;
    expiresAt?: Date;
  },
) {
  return prisma.booking.create({
    data: {
      customerId: opts.customerId,
      workerId: opts.workerId,
      categoryId: opts.categoryId,
      barangayId: opts.barangayId,
      status: opts.status ?? BookingStatus.PENDING,
      bookingType: BookingType.ON_SITE,
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      timeWindow: TimeWindow.MORNING,
      locationLat: 14.5,
      locationLng: 121.0,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
    },
  });
}

export async function createVerificationDoc(
  prisma: PrismaService,
  workerId: string,
  overrides: { status?: VerificationStatus } = {},
) {
  return prisma.verificationDoc.create({
    data: {
      workerId,
      idPhotoUrl: 'https://example.com/id.jpg',
      selfieUrl: 'https://example.com/selfie.jpg',
      status: overrides.status ?? VerificationStatus.PENDING,
    },
  });
}
