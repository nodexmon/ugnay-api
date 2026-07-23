import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role, UserStatus } from '../src/generated/prisma/enums';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  }),
});

const categories = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Electrician',
    slug: 'electrician',
    sortOrder: 1,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Plumber',
    slug: 'plumber',
    sortOrder: 2,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Carpenter',
    slug: 'carpenter',
    sortOrder: 3,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Painter',
    slug: 'painter',
    sortOrder: 4,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Mason',
    slug: 'mason',
    sortOrder: 5,
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    name: 'House Cleaner',
    slug: 'house-cleaner',
    sortOrder: 6,
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    sortOrder: 7,
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    name: 'Gardener',
    slug: 'gardener',
    sortOrder: 8,
  },
];

const barangays = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Canubing I' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Canubing II' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Lalud' },
  { id: '20000000-0000-4000-8000-000000000004', name: 'Lumangbayan' },
  { id: '20000000-0000-4000-8000-000000000005', name: 'Batino' },
  { id: '20000000-0000-4000-8000-000000000006', name: 'Masipit' },
  { id: '20000000-0000-4000-8000-000000000007', name: 'Silonay' },
  { id: '20000000-0000-4000-8000-000000000008', name: 'Villaflor' },
];

async function main() {
  await cleanUserData();
  await seedCatalog();
  await seedAdmin();
  console.info('Seed complete. Categories and barangays are ready.');
}

async function cleanUserData() {
  // Bookings must go first — Restrict FK on worker/customerProfile prevents
  // profile deletion while bookings exist. Cascade handles Review + NoShowReport.
  // Strike.bookingId is set to null (SetNull) on booking deletion.
  await prisma.booking.deleteMany();
  await prisma.strike.deleteMany();
  await prisma.otpRequest.deleteMany();
  // Deleting users cascades: RefreshToken, PushToken, WorkerProfile
  // (→ WorkerCategory, WorkerServiceArea, VerificationDoc, WorkerCredential),
  // and CustomerProfile.
  await prisma.user.deleteMany();
}

async function seedCatalog() {
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        ...category,
        iconUrl: `https://example.com/icons/${category.slug}.svg`,
        isActive: true,
      },
    });
  }

  for (const barangay of barangays) {
    await prisma.barangay.upsert({
      where: { id: barangay.id },
      update: { name: barangay.name, isActive: true },
      create: { ...barangay, isActive: true },
    });
  }
}

async function seedAdmin() {
  const phone = process.env['ADMIN_PHONE'];

  if (!phone) {
    console.warn('ADMIN_PHONE not set — skipping admin seed.');
    return;
  }

  if (!/^\+63\d{10}$/.test(phone)) {
    throw new Error('ADMIN_PHONE must be in E.164 format (+63XXXXXXXXXX).');
  }

  await prisma.user.upsert({
    where: { phone },
    update: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    create: { phone, role: Role.ADMIN },
  });
  console.info(`Admin user seeded for ${phone}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
