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
  { id: '20000000-0000-4000-8000-000000000004', name: 'Lumang Bayan' },
  { id: '20000000-0000-4000-8000-000000000005', name: 'Batino' },
  { id: '20000000-0000-4000-8000-000000000006', name: 'Masipit' },
  { id: '20000000-0000-4000-8000-000000000007', name: 'Silonay' },
  { id: '20000000-0000-4000-8000-000000000008', name: 'Villaflor' },
  { id: '20000000-0000-4000-8000-000000000009', name: 'Balingayan' },
  { id: '20000000-0000-4000-8000-000000000010', name: 'Balite' },
  { id: '20000000-0000-4000-8000-000000000011', name: 'Baruyan' },
  { id: '20000000-0000-4000-8000-000000000012', name: 'Bayanan I' },
  { id: '20000000-0000-4000-8000-000000000013', name: 'Bayanan II' },
  { id: '20000000-0000-4000-8000-000000000014', name: 'Biga' },
  { id: '20000000-0000-4000-8000-000000000015', name: 'Bondoc' },
  { id: '20000000-0000-4000-8000-000000000016', name: 'Bucayao' },
  { id: '20000000-0000-4000-8000-000000000017', name: 'Buhuan' },
  { id: '20000000-0000-4000-8000-000000000018', name: 'Bulusan' },
  { id: '20000000-0000-4000-8000-000000000019', name: 'Calero' },
  { id: '20000000-0000-4000-8000-000000000020', name: 'Camansihan' },
  { id: '20000000-0000-4000-8000-000000000021', name: 'Camilmil' },
  { id: '20000000-0000-4000-8000-000000000022', name: 'Comunal' },
  { id: '20000000-0000-4000-8000-000000000023', name: 'Guinobatan' },
  { id: '20000000-0000-4000-8000-000000000024', name: 'Gulod' },
  { id: '20000000-0000-4000-8000-000000000025', name: 'Gutad' },
  { id: '20000000-0000-4000-8000-000000000026', name: 'Ibaba East' },
  { id: '20000000-0000-4000-8000-000000000027', name: 'Ibaba West' },
  { id: '20000000-0000-4000-8000-000000000028', name: 'Ilaya' },
  { id: '20000000-0000-4000-8000-000000000029', name: 'Lazareto' },
  { id: '20000000-0000-4000-8000-000000000030', name: 'Libis' },
  { id: '20000000-0000-4000-8000-000000000031', name: 'Mahal na Pangalan' },
  { id: '20000000-0000-4000-8000-000000000032', name: 'Maidlang' },
  { id: '20000000-0000-4000-8000-000000000033', name: 'Malad' },
  { id: '20000000-0000-4000-8000-000000000034', name: 'Malamig' },
  { id: '20000000-0000-4000-8000-000000000035', name: 'Managpi' },
  { id: '20000000-0000-4000-8000-000000000036', name: 'Nag-iba I' },
  { id: '20000000-0000-4000-8000-000000000037', name: 'Nag-iba II' },
  { id: '20000000-0000-4000-8000-000000000038', name: 'Navotas' },
  { id: '20000000-0000-4000-8000-000000000039', name: 'Pachoca' },
  { id: '20000000-0000-4000-8000-000000000040', name: 'Palhi' },
  { id: '20000000-0000-4000-8000-000000000041', name: 'Panggalaan' },
  { id: '20000000-0000-4000-8000-000000000042', name: 'Parang' },
  { id: '20000000-0000-4000-8000-000000000043', name: 'Patas' },
  { id: '20000000-0000-4000-8000-000000000044', name: 'Personas' },
  { id: '20000000-0000-4000-8000-000000000045', name: 'Putingtubig' },
  { id: '20000000-0000-4000-8000-000000000046', name: 'Salong' },
  { id: '20000000-0000-4000-8000-000000000047', name: 'San Antonio' },
  { id: '20000000-0000-4000-8000-000000000048', name: 'San Vicente Central' },
  { id: '20000000-0000-4000-8000-000000000049', name: 'San Vicente East' },
  { id: '20000000-0000-4000-8000-000000000050', name: 'San Vicente North' },
  { id: '20000000-0000-4000-8000-000000000051', name: 'San Vicente South' },
  { id: '20000000-0000-4000-8000-000000000052', name: 'San Vicente West' },
  { id: '20000000-0000-4000-8000-000000000053', name: 'Santa Cruz' },
  { id: '20000000-0000-4000-8000-000000000054', name: 'Santa Isabel' },
  { id: '20000000-0000-4000-8000-000000000055', name: 'Santa Maria Village' },
  { id: '20000000-0000-4000-8000-000000000056', name: 'Santa Rita' },
  { id: '20000000-0000-4000-8000-000000000057', name: 'Santo Niño' },
  { id: '20000000-0000-4000-8000-000000000058', name: 'Sapul' },
  { id: '20000000-0000-4000-8000-000000000059', name: 'Suqui' },
  { id: '20000000-0000-4000-8000-000000000060', name: 'Tawagan' },
  { id: '20000000-0000-4000-8000-000000000061', name: 'Tawiran' },
  { id: '20000000-0000-4000-8000-000000000062', name: 'Tibag' },
  { id: '20000000-0000-4000-8000-000000000063', name: 'Wawa' },
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

  section('Barangays');
  for (const barangay of barangays) {
    await prisma.barangay.upsert({
      where: { id: barangay.id },
      update: { name: barangay.name, isActive: true },
      create: { ...barangay, isActive: true },
    });
    row(barangay.name, 'upserted');
  }
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
