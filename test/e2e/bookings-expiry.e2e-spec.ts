import { BookingStatus } from '@/generated/prisma/enums';
import { BookingsCron } from '@/modules/bookings/bookings.cron';
import { createTestApp, TestApp } from './test-app';
import { resetDb, createBarangay, createCategory, createCustomer, createWorker, createBooking } from './db';

describe('Booking expiry cron (e2e)', () => {
  let testApp: TestApp;
  let barangayId: string;
  let categoryId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(testApp.prisma);
    const barangay = await createBarangay(testApp.prisma);
    const category = await createCategory(testApp.prisma);
    barangayId = barangay.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('expires past-due PENDING bookings and leaves others untouched', async () => {
    const { profile: customerProfile } = await createCustomer(testApp.prisma);
    const { profile: workerProfile } = await createWorker(testApp.prisma, barangayId);

    const expiredBooking = await createBooking(testApp.prisma, {
      customerId: customerProfile.id,
      workerId: workerProfile.id,
      categoryId,
      barangayId,
      status: BookingStatus.PENDING,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
    });

    const futureBooking = await createBooking(testApp.prisma, {
      customerId: customerProfile.id,
      workerId: workerProfile.id,
      categoryId,
      barangayId,
      status: BookingStatus.PENDING,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes in the future
    });

    const acceptedExpiredBooking = await createBooking(testApp.prisma, {
      customerId: customerProfile.id,
      workerId: workerProfile.id,
      categoryId,
      barangayId,
      status: BookingStatus.ACCEPTED,
      expiresAt: new Date(Date.now() - 60 * 1000), // past expiry but already accepted
    });

    const cron = testApp.app.get(BookingsCron);
    await cron.expiredPendingBookings();

    const [b1, b2, b3] = await Promise.all([
      testApp.prisma.booking.findUnique({ where: { id: expiredBooking.id } }),
      testApp.prisma.booking.findUnique({ where: { id: futureBooking.id } }),
      testApp.prisma.booking.findUnique({ where: { id: acceptedExpiredBooking.id } }),
    ]);

    expect(b1?.status).toBe(BookingStatus.EXPIRED);
    expect(b2?.status).toBe(BookingStatus.PENDING);
    expect(b3?.status).toBe(BookingStatus.ACCEPTED);
  });
});
