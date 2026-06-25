import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config"

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env["DATABASE_URL"],
  }),
});

const categories = [
  { name: 'Electrician', slug: 'electrician', sortOrder: 1 },
  { name: 'Plumber', slug: 'plumber', sortOrder: 2 },
  { name: 'Carpenter', slug: 'carpenter', sortOrder: 3 },
  { name: 'Painter', slug: 'painter', sortOrder: 4 },
  { name: 'Mason', slug: 'mason', sortOrder: 5 },
  { name: 'House Cleaner', slug: 'house-cleaner', sortOrder: 6 },
  { name: 'Appliance Repair', slug: 'appliance-repair', sortOrder: 7 },
  { name: 'Gardener', slug: 'gardener', sortOrder: 8 },
];

// Placeholder municipality data. Replace names and centroids before launch.
const barangays = [
  { name: 'Barangay Uno', centroidLat: 14.5995, centroidLng: 120.9842 },
  { name: 'Barangay Dos', centroidLat: 14.6042, centroidLng: 120.9911 },
  { name: 'Barangay Tres', centroidLat: 14.5928, centroidLng: 120.9798 },
  { name: 'Barangay Quatro', centroidLat: 14.5881, centroidLng: 120.9874 },
  { name: 'Barangay Singko', centroidLat: 14.6088, centroidLng: 120.9769 },
];

async function main() {
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
        isActive: true,
      },
    });
  }

  for (const barangay of barangays) {
    await prisma.barangay.upsert({
      where: { name: barangay.name },
      update: {
        centroidLat: barangay.centroidLat,
        centroidLng: barangay.centroidLng,
        isActive: true,
      },
      create: {
        ...barangay,
        isActive: true,
      },
    });
  }
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
