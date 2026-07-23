import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role, UserStatus } from '../src/generated/prisma/enums';
import 'dotenv/config';
import { psgcConfig } from '../src/config/psgc.config';

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

const WIDTH = 44;
const BORDER = '='.repeat(WIDTH);
const SEP = '-'.repeat(WIDTH);

function row(label: string, status: string): void {
  const dots = '.'.repeat(
    Math.max(1, WIDTH - 2 - label.length - status.length),
  );
  console.log(`  ${label} ${dots} ${status}`);
}

function section(title: string): void {
  console.log(`\n  ${title}`);
  console.log(`  ${SEP.slice(0, WIDTH - 2)}`);
}

async function main() {
  console.log(`\n${BORDER}`);
  console.log(`${'UGNAY  DB  SEED'.padStart((WIDTH + 15) / 2).padEnd(WIDTH)}`);
  console.log(BORDER);

  await cleanUserData();
  await seedCatalog();
  await seedAdmin();

  console.log(`\n${BORDER}`);
  console.log('  All done.');
  console.log(`${BORDER}\n`);
}

async function cleanUserData() {
  section('Cleaning user data');
  await prisma.booking.deleteMany();
  row('Bookings', 'cleared');
  await prisma.strike.deleteMany();
  row('Strikes', 'cleared');
  await prisma.otpRequest.deleteMany();
  row('OTP requests', 'cleared');
  await prisma.user.deleteMany();
  row('Users', 'cleared');
}

async function seedCatalog() {
  section('Categories');
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
    row(category.name, 'upserted');
  }

  await syncBarangaysFromPsgc();
}

async function syncBarangaysFromPsgc(): Promise<void> {
  section('Barangays (PSGC sync)');

  const { apiUrl, calapanCityCode } = psgcConfig();
  const url = `${apiUrl}/cities-municipalities/${calapanCityCode}/barangays.json`;

  let fetched: { code: string; name: string }[];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fetched = (await res.json()) as { code: string; name: string }[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    row('PSGC API unreachable', `skipped (${message})`);
    return;
  }

  const fetchedCodes = new Set(fetched.map((b) => b.code));
  let created = 0;
  let updated = 0;

  for (const { code, name } of fetched) {
    const existing = await prisma.barangay.findFirst({
      where: { OR: [{ psgcCode: code }, { name }] },
    });

    if (existing) {
      await prisma.barangay.update({
        where: { id: existing.id },
        data: { psgcCode: code, name, isActive: true },
      });
      updated++;
    } else {
      await prisma.barangay.create({
        data: { psgcCode: code, name, isActive: true },
      });
      created++;
    }
  }

  const { count: deactivated } = await prisma.barangay.updateMany({
    where: {
      isActive: true,
      psgcCode: { notIn: [...fetchedCodes], not: null },
    },
    data: { isActive: false },
  });

  row('Created', String(created));
  row('Updated', String(updated));
  row('Deactivated', String(deactivated));
  row('Total from API', String(fetched.length));
}

async function seedAdmin() {
  section('Admin');
  const phone = process.env['ADMIN_PHONE'];

  if (!phone) {
    row('ADMIN_PHONE not set', 'skipped');
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
  row(phone, 'seeded');
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
