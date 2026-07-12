import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  BookingStatus,
  BookingType,
  CancellationActor,
  Platform,
  Role,
  StrikeReason,
  TimeWindow,
  UserStatus,
  VerificationStatus,
  WorkerStatus,
} from '../src/generated/prisma/enums';
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

const users = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    phone: '+639170000001',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    phone: '+639170000002',
    role: Role.CUSTOMER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    phone: '+639170000003',
    role: Role.CUSTOMER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    phone: '+639170000004',
    role: Role.CUSTOMER,
    status: UserStatus.SUSPENDED,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    phone: '+639170000005',
    role: Role.WORKER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    phone: '+639170000006',
    role: Role.WORKER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    phone: '+639170000007',
    role: Role.WORKER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    phone: '+639170000008',
    role: Role.WORKER,
    status: UserStatus.ACTIVE,
  },
  {
    id: '30000000-0000-4000-8000-000000000009',
    phone: '+639170000009',
    role: Role.WORKER,
    status: UserStatus.SUSPENDED,
  },
  {
    id: '30000000-0000-4000-8000-000000000010',
    phone: '+639170000010',
    role: Role.WORKER,
    status: UserStatus.ACTIVE,
  },
];

const customers = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    userId: users[1].id,
    firstName: 'Mika',
    lastName: 'Santos',
    avatarUrl: 'https://example.com/avatars/customer-mika.jpg',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    userId: users[2].id,
    firstName: 'Rafael',
    lastName: 'Dela Cruz',
    avatarUrl: 'https://example.com/avatars/customer-rafael.jpg',
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    userId: users[3].id,
    firstName: 'Camille',
    lastName: 'Reyes',
    avatarUrl: null,
  },
];

const workers = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    userId: users[4].id,
    firstName: 'Jun',
    lastName: 'Garcia',
    bio: 'Licensed electrician for residential repairs, rewiring, and fixture installation.',
    avatarUrl: 'https://example.com/avatars/worker-jun.jpg',
    baseRate: 650,
    status: WorkerStatus.VERIFIED,
    isOnline: true,
    homeBarangayId: barangays[0].id,
    strikeCount: 0,
    totalJobsCompleted: 24,
    averageRating: 4.82,
    totalReviews: 17,
    categorySlugs: ['electrician', 'appliance-repair'],
    serviceBarangayNames: ['Canubing I', 'Canubing II', 'Lalud', 'Silonay'],
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    userId: users[5].id,
    firstName: 'Lito',
    lastName: 'Navarro',
    bio: 'Plumbing specialist for leaks, clogged drains, faucet replacement, and water tank issues.',
    avatarUrl: 'https://example.com/avatars/worker-lito.jpg',
    baseRate: 550,
    status: WorkerStatus.VERIFIED,
    isOnline: false,
    homeBarangayId: barangays[1].id,
    strikeCount: 1,
    totalJobsCompleted: 13,
    averageRating: 4.46,
    totalReviews: 9,
    categorySlugs: ['plumber', 'mason'],
    serviceBarangayNames: ['Canubing II', 'Lalud', 'Lumangbayan'],
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    userId: users[6].id,
    firstName: 'Ana',
    lastName: 'Villanueva',
    bio: 'Detailed home cleaning, move-in cleaning, and light organizing.',
    avatarUrl: 'https://example.com/avatars/worker-ana.jpg',
    baseRate: 450,
    status: WorkerStatus.PENDING,
    isOnline: false,
    homeBarangayId: barangays[2].id,
    strikeCount: 0,
    totalJobsCompleted: 0,
    averageRating: 0,
    totalReviews: 0,
    categorySlugs: ['house-cleaner'],
    serviceBarangayNames: ['Lalud', 'Batino'],
  },
  {
    id: '50000000-0000-4000-8000-000000000004',
    userId: users[7].id,
    firstName: 'Marco',
    lastName: 'Bautista',
    bio: 'Carpentry and painting for cabinets, doors, partitions, and small renovations.',
    avatarUrl: 'https://example.com/avatars/worker-marco.jpg',
    baseRate: 700,
    status: WorkerStatus.REJECTED,
    isOnline: false,
    homeBarangayId: barangays[3].id,
    strikeCount: 0,
    totalJobsCompleted: 2,
    averageRating: 4.0,
    totalReviews: 1,
    categorySlugs: ['carpenter', 'painter'],
    serviceBarangayNames: ['Lumangbayan', 'Villaflor'],
  },
  {
    id: '50000000-0000-4000-8000-000000000005',
    userId: users[8].id,
    firstName: 'Neri',
    lastName: 'Flores',
    bio: 'Gardening, hedge trimming, and yard clearing.',
    avatarUrl: 'https://example.com/avatars/worker-neri.jpg',
    baseRate: 500,
    status: WorkerStatus.SUSPENDED,
    isOnline: false,
    homeBarangayId: barangays[4].id,
    strikeCount: 3,
    totalJobsCompleted: 8,
    averageRating: 3.21,
    totalReviews: 6,
    categorySlugs: ['gardener'],
    serviceBarangayNames: ['Batino', 'Masipit'],
  },
  {
    id: '50000000-0000-4000-8000-000000000006',
    userId: users[9].id,
    firstName: 'Bea',
    lastName: 'Mendoza',
    bio: 'Appliance repair for washing machines, refrigerators, and small kitchen appliances.',
    avatarUrl: 'https://example.com/avatars/worker-bea.jpg',
    baseRate: 600,
    status: WorkerStatus.VERIFIED,
    isOnline: true,
    homeBarangayId: barangays[5].id,
    strikeCount: 0,
    totalJobsCompleted: 19,
    averageRating: 4.74,
    totalReviews: 14,
    categorySlugs: ['appliance-repair', 'electrician'],
    serviceBarangayNames: ['Canubing I', 'Batino', 'Masipit', 'Silonay'],
  },
];

const bookings = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    customerId: customers[0].id,
    workerId: workers[0].id,
    categorySlug: 'electrician',
    barangayName: 'Canubing I',
    status: BookingStatus.PENDING,
    bookingType: BookingType.IMMEDIATE,
    scheduledDate: daysFromNow(0, 10),
    timeWindow: TimeWindow.MORNING,
    locationLat: 14.6001,
    locationLng: 120.9845,
    locationAddress: '12 Mabini Street, Canubing I',
    notes: 'Outlet sparks when the rice cooker is plugged in.',
    agreedRate: null,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: minutesFromNow(30),
    cancellationActor: null,
    cancellationReason: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    customerId: customers[1].id,
    workerId: workers[5].id,
    categorySlug: 'appliance-repair',
    barangayName: 'Masipit',
    status: BookingStatus.ACCEPTED,
    bookingType: BookingType.SCHEDULED,
    scheduledDate: daysFromNow(1, 14),
    timeWindow: TimeWindow.AFTERNOON,
    locationLat: 14.6147,
    locationLng: 120.9825,
    locationAddress: '88 Rizal Avenue, Masipit',
    notes: 'Front-load washing machine stops mid-cycle.',
    agreedRate: 750,
    acceptedAt: minutesFromNow(-15),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: minutesFromNow(15),
    cancellationActor: null,
    cancellationReason: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    customerId: customers[0].id,
    workerId: workers[1].id,
    categorySlug: 'plumber',
    barangayName: 'Canubing II',
    status: BookingStatus.IN_PROGRESS,
    bookingType: BookingType.IMMEDIATE,
    scheduledDate: daysFromNow(0, 9),
    timeWindow: TimeWindow.MORNING,
    locationLat: 14.6039,
    locationLng: 120.9908,
    locationAddress: '45 Bonifacio Road, Canubing II',
    notes: 'Kitchen sink pipe is leaking under the cabinet.',
    agreedRate: 600,
    acceptedAt: minutesFromNow(-90),
    startedAt: minutesFromNow(-20),
    completedAt: null,
    cancelledAt: null,
    expiresAt: minutesFromNow(-60),
    cancellationActor: null,
    cancellationReason: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000004',
    customerId: customers[1].id,
    workerId: workers[0].id,
    categorySlug: 'electrician',
    barangayName: 'Lalud',
    status: BookingStatus.COMPLETED,
    bookingType: BookingType.SCHEDULED,
    scheduledDate: daysFromNow(-3, 16),
    timeWindow: TimeWindow.AFTERNOON,
    locationLat: 14.5932,
    locationLng: 120.98,
    locationAddress: '21 Luna Extension, Lalud',
    notes: 'Install two ceiling light fixtures.',
    agreedRate: 900,
    acceptedAt: daysFromNow(-4, 11),
    startedAt: daysFromNow(-3, 16),
    completedAt: daysFromNow(-3, 17),
    cancelledAt: null,
    expiresAt: daysFromNow(-4, 12),
    cancellationActor: null,
    cancellationReason: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000005',
    customerId: customers[0].id,
    workerId: workers[5].id,
    categorySlug: 'appliance-repair',
    barangayName: 'Silonay',
    status: BookingStatus.COMPLETED,
    bookingType: BookingType.SCHEDULED,
    scheduledDate: daysFromNow(-9, 18),
    timeWindow: TimeWindow.EVENING,
    locationLat: 14.5954,
    locationLng: 120.9962,
    locationAddress: '7 Sampaguita Lane, Silonay',
    notes: 'Refrigerator is cooling weakly.',
    agreedRate: 800,
    acceptedAt: daysFromNow(-10, 13),
    startedAt: daysFromNow(-9, 18),
    completedAt: daysFromNow(-9, 19),
    cancelledAt: null,
    expiresAt: daysFromNow(-10, 13, 30),
    cancellationActor: null,
    cancellationReason: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000006',
    customerId: customers[1].id,
    workerId: workers[1].id,
    categorySlug: 'plumber',
    barangayName: 'Lumangbayan',
    status: BookingStatus.CANCELLED,
    bookingType: BookingType.SCHEDULED,
    scheduledDate: daysFromNow(2, 8),
    timeWindow: TimeWindow.MORNING,
    locationLat: 14.5884,
    locationLng: 120.987,
    locationAddress: '5 Aguinaldo Street, Lumangbayan',
    notes: 'Bathroom drain cleaning.',
    agreedRate: 550,
    acceptedAt: daysFromNow(-1, 15),
    startedAt: null,
    completedAt: null,
    cancelledAt: daysFromNow(-1, 16),
    expiresAt: daysFromNow(-1, 15, 30),
    cancellationActor: CancellationActor.WORKER,
    cancellationReason: 'Worker reported unavailable after accepting.',
  },
  {
    id: '60000000-0000-4000-8000-000000000007',
    customerId: customers[0].id,
    workerId: workers[0].id,
    categorySlug: 'electrician',
    barangayName: 'Canubing I',
    status: BookingStatus.EXPIRED,
    bookingType: BookingType.IMMEDIATE,
    scheduledDate: daysFromNow(-1, 11),
    timeWindow: TimeWindow.MORNING,
    locationLat: 14.599,
    locationLng: 120.984,
    locationAddress: '33 Burgos Street, Canubing I',
    notes: 'Breaker trips when aircon starts.',
    agreedRate: null,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: minutesFromNow(-120),
    cancellationActor: CancellationActor.SYSTEM,
    cancellationReason: 'Worker did not respond within the acceptance window.',
  },
  {
    id: '60000000-0000-4000-8000-000000000008',
    customerId: customers[1].id,
    workerId: workers[4].id,
    categorySlug: 'gardener',
    barangayName: 'Batino',
    status: BookingStatus.NO_SHOW,
    bookingType: BookingType.SCHEDULED,
    scheduledDate: daysFromNow(-7, 7),
    timeWindow: TimeWindow.MORNING,
    locationLat: 14.6091,
    locationLng: 120.9771,
    locationAddress: '19 Narra Court, Batino',
    notes: 'Clear overgrown yard before weekend.',
    agreedRate: 650,
    acceptedAt: daysFromNow(-8, 10),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: daysFromNow(-8, 10, 30),
    cancellationActor: null,
    cancellationReason: null,
  },
];

async function main() {
  await seedCatalog();
  await seedUsers();
  await seedCustomers();
  await seedWorkers();
  await seedVerificationDocs();
  await seedAuthArtifacts();
  await seedBookings();
  await seedReviews();
  await seedNoShowReports();
  await seedStrikes();

  console.info('Seed data is ready for API testing.');
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
      where: { name: barangay.name },
      update: { isActive: true },
      create: { ...barangay, isActive: true },
    });
  }
}

async function seedUsers() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        role: user.role,
        status: user.status,
      },
      create: user,
    });
  }
}

async function seedCustomers() {
  for (const customer of customers) {
    await prisma.customerProfile.upsert({
      where: { userId: customer.userId },
      update: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        avatarUrl: customer.avatarUrl,
      },
      create: customer,
    });
  }
}

async function seedWorkers() {
  for (const worker of workers) {
    await prisma.workerProfile.upsert({
      where: { userId: worker.userId },
      update: {
        firstName: worker.firstName,
        lastName: worker.lastName,
        bio: worker.bio,
        avatarUrl: worker.avatarUrl,
        baseRate: worker.baseRate,
        status: worker.status,
        isOnline: worker.isOnline,
        homeBarangayId: worker.homeBarangayId,
        strikeCount: worker.strikeCount,
        totalJobsCompleted: worker.totalJobsCompleted,
        averageRating: worker.averageRating,
        totalReviews: worker.totalReviews,
      },
      create: {
        id: worker.id,
        userId: worker.userId,
        firstName: worker.firstName,
        lastName: worker.lastName,
        bio: worker.bio,
        avatarUrl: worker.avatarUrl,
        baseRate: worker.baseRate,
        status: worker.status,
        isOnline: worker.isOnline,
        homeBarangayId: worker.homeBarangayId,
        strikeCount: worker.strikeCount,
        totalJobsCompleted: worker.totalJobsCompleted,
        averageRating: worker.averageRating,
        totalReviews: worker.totalReviews,
      },
    });

    await prisma.workerCategory.deleteMany({ where: { workerId: worker.id } });
    await prisma.workerCategory.createMany({
      data: worker.categorySlugs.map((slug) => ({
        workerId: worker.id,
        categoryId: categoryId(slug),
        rateOverride: worker.baseRate + (slug === 'appliance-repair' ? 150 : 0),
      })),
    });

    await prisma.workerServiceArea.deleteMany({
      where: { workerId: worker.id },
    });
    await prisma.workerServiceArea.createMany({
      data: worker.serviceBarangayNames.map((name) => ({
        workerId: worker.id,
        barangayId: barangayId(name),
      })),
    });
  }
}

async function seedVerificationDocs() {
  const docs = [
    {
      id: '70000000-0000-4000-8000-000000000001',
      workerId: workers[0].id,
      status: VerificationStatus.APPROVED,
      reviewedBy: users[0].id,
      reviewedAt: daysFromNow(-20, 10),
      rejectionReason: null,
    },
    {
      id: '70000000-0000-4000-8000-000000000002',
      workerId: workers[1].id,
      status: VerificationStatus.APPROVED,
      reviewedBy: users[0].id,
      reviewedAt: daysFromNow(-12, 15),
      rejectionReason: null,
    },
    {
      id: '70000000-0000-4000-8000-000000000003',
      workerId: workers[2].id,
      status: VerificationStatus.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    },
    {
      id: '70000000-0000-4000-8000-000000000004',
      workerId: workers[3].id,
      status: VerificationStatus.REJECTED,
      reviewedBy: users[0].id,
      reviewedAt: daysFromNow(-2, 11),
      rejectionReason: 'Submitted ID photo is unreadable.',
    },
    {
      id: '70000000-0000-4000-8000-000000000005',
      workerId: workers[5].id,
      status: VerificationStatus.APPROVED,
      reviewedBy: users[0].id,
      reviewedAt: daysFromNow(-18, 9),
      rejectionReason: null,
    },
  ];

  for (const doc of docs) {
    await prisma.verificationDoc.upsert({
      where: { id: doc.id },
      update: {
        status: doc.status,
        reviewedBy: doc.reviewedBy,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
      },
      create: {
        ...doc,
        idPhotoUrl: `/seed/verification/${doc.workerId}/id-photo.jpg`,
        selfieUrl: `/seed/verification/${doc.workerId}/selfie.jpg`,
      },
    });
  }
}

async function seedAuthArtifacts() {
  const pushTokens = [
    {
      id: '80000000-0000-4000-8000-000000000001',
      userId: users[1].id,
      token: 'seed-ios-customer-mika',
      platform: Platform.IOS,
    },
    {
      id: '80000000-0000-4000-8000-000000000002',
      userId: users[4].id,
      token: 'seed-android-worker-jun',
      platform: Platform.ANDROID,
    },
    {
      id: '80000000-0000-4000-8000-000000000003',
      userId: users[9].id,
      token: 'seed-ios-worker-bea',
      platform: Platform.IOS,
    },
  ];

  for (const pushToken of pushTokens) {
    await prisma.pushToken.upsert({
      where: { token: pushToken.token },
      update: {
        userId: pushToken.userId,
        platform: pushToken.platform,
      },
      create: pushToken,
    });
  }

  const otpRequests = [
    {
      id: '81000000-0000-4000-8000-000000000001',
      userId: users[1].id,
      phone: users[1].phone,
      code: '111111',
      verified: true,
      expiresAt: minutesFromNow(10),
    },
    {
      id: '81000000-0000-4000-8000-000000000002',
      userId: users[4].id,
      phone: users[4].phone,
      code: '222222',
      verified: false,
      expiresAt: minutesFromNow(10),
    },
    {
      id: '81000000-0000-4000-8000-000000000003',
      userId: null,
      phone: '+639179999999',
      code: '999999',
      verified: false,
      expiresAt: minutesFromNow(-5),
    },
  ];

  for (const otpRequest of otpRequests) {
    await prisma.otpRequest.upsert({
      where: { id: otpRequest.id },
      update: {
        userId: otpRequest.userId,
        phone: otpRequest.phone,
        code: otpRequest.code,
        verified: otpRequest.verified,
        expiresAt: otpRequest.expiresAt,
      },
      create: otpRequest,
    });
  }

  const refreshTokens = [
    {
      id: '82000000-0000-4000-8000-000000000001',
      userId: users[1].id,
      tokenHash: 'seed-refresh-token-customer-mika',
      expiresAt: daysFromNow(30, 0),
      revokedAt: null,
    },
    {
      id: '82000000-0000-4000-8000-000000000002',
      userId: users[4].id,
      tokenHash: 'seed-refresh-token-worker-jun-revoked',
      expiresAt: daysFromNow(30, 0),
      revokedAt: minutesFromNow(-30),
    },
  ];

  for (const refreshToken of refreshTokens) {
    await prisma.refreshToken.upsert({
      where: { tokenHash: refreshToken.tokenHash },
      update: {
        userId: refreshToken.userId,
        expiresAt: refreshToken.expiresAt,
        revokedAt: refreshToken.revokedAt,
      },
      create: refreshToken,
    });
  }
}

async function seedBookings() {
  for (const booking of bookings) {
    await prisma.booking.upsert({
      where: { id: booking.id },
      update: {
        status: booking.status,
        bookingType: booking.bookingType,
        scheduledDate: booking.scheduledDate,
        timeWindow: booking.timeWindow,
        locationLat: booking.locationLat,
        locationLng: booking.locationLng,
        locationAddress: booking.locationAddress,
        notes: booking.notes,
        agreedRate: booking.agreedRate,
        acceptedAt: booking.acceptedAt,
        startedAt: booking.startedAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        expiresAt: booking.expiresAt,
        cancellationActor: booking.cancellationActor,
        cancellationReason: booking.cancellationReason,
      },
      create: {
        id: booking.id,
        customerId: booking.customerId,
        workerId: booking.workerId,
        categoryId: categoryId(booking.categorySlug),
        barangayId: barangayId(booking.barangayName),
        status: booking.status,
        bookingType: booking.bookingType,
        scheduledDate: booking.scheduledDate,
        timeWindow: booking.timeWindow,
        locationLat: booking.locationLat,
        locationLng: booking.locationLng,
        locationAddress: booking.locationAddress,
        notes: booking.notes,
        agreedRate: booking.agreedRate,
        acceptedAt: booking.acceptedAt,
        startedAt: booking.startedAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        expiresAt: booking.expiresAt,
        cancellationActor: booking.cancellationActor,
        cancellationReason: booking.cancellationReason,
      },
    });
  }
}

async function seedReviews() {
  const reviews = [
    {
      id: '90000000-0000-4000-8000-000000000001',
      bookingId: bookings[3].id,
      customerId: customers[1].id,
      workerId: workers[0].id,
      rating: 5,
      comment: 'Arrived on time and explained the wiring issue clearly.',
    },
    {
      id: '90000000-0000-4000-8000-000000000002',
      bookingId: bookings[4].id,
      customerId: customers[0].id,
      workerId: workers[5].id,
      rating: 4,
      comment:
        'Fridge is working again. Needed one extra part but communicated well.',
    },
  ];

  for (const review of reviews) {
    await prisma.review.upsert({
      where: { bookingId: review.bookingId },
      update: {
        customerId: review.customerId,
        workerId: review.workerId,
        rating: review.rating,
        comment: review.comment,
      },
      create: review,
    });
  }
}

async function seedNoShowReports() {
  const reports = [
    {
      id: '91000000-0000-4000-8000-000000000001',
      bookingId: bookings[7].id,
      reportedBy: users[2].id,
      description:
        'Worker did not arrive and did not answer calls after the scheduled time.',
      resolvedBy: users[0].id,
      resolvedAt: daysFromNow(-6, 12),
      confirmed: true,
    },
  ];

  for (const report of reports) {
    await prisma.noShowReport.upsert({
      where: { bookingId: report.bookingId },
      update: {
        reportedBy: report.reportedBy,
        description: report.description,
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
        confirmed: report.confirmed,
      },
      create: report,
    });
  }
}

async function seedStrikes() {
  const strikes = [
    {
      id: '92000000-0000-4000-8000-000000000001',
      workerId: workers[1].id,
      bookingId: bookings[5].id,
      reason: StrikeReason.POST_ACCEPT_CANCELLATION,
      issuedBy: users[0].id,
      notes: 'Cancelled one hour after accepting the job.',
    },
    {
      id: '92000000-0000-4000-8000-000000000002',
      workerId: workers[4].id,
      bookingId: bookings[7].id,
      reason: StrikeReason.NO_SHOW,
      issuedBy: users[0].id,
      notes: 'No-show report confirmed by admin.',
    },
    {
      id: '92000000-0000-4000-8000-000000000003',
      workerId: workers[4].id,
      bookingId: null,
      reason: StrikeReason.CUSTOMER_COMPLAINT,
      issuedBy: users[0].id,
      notes: 'Validated complaint from prior off-platform follow-up.',
    },
  ];

  for (const strike of strikes) {
    await prisma.strike.upsert({
      where: { id: strike.id },
      update: {
        workerId: strike.workerId,
        bookingId: strike.bookingId,
        reason: strike.reason,
        issuedBy: strike.issuedBy,
        notes: strike.notes,
      },
      create: strike,
    });
  }
}

function categoryId(slug: string) {
  const category = categories.find((item) => item.slug === slug);
  if (!category) throw new Error(`Unknown category slug: ${slug}`);
  return category.id;
}

function barangayId(name: string) {
  const barangay = barangays.find((item) => item.name === name);
  if (!barangay) throw new Error(`Unknown barangay name: ${name}`);
  return barangay.id;
}

function minutesFromNow(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function daysFromNow(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
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
