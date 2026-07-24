import {
  BookingStatus,
  CancellationActor,
  NoShowReportType,
} from '@/generated/prisma/enums';
import { BookingsCron } from '@/modules/bookings/bookings.cron';
import { createTestApp, TestApp } from './test-app';
import {
  resetDb,
  createBarangay,
  createCategory,
  createCustomer,
  createWorker,
  createBooking,
} from './db';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const STALE_CANCEL_REASON =
  'Booking was automatically cancelled because it was never started.';

describe('Stale ACCEPTED booking auto-cancel cron (e2e, BKG-11)', () => {
  let testApp: TestApp;
  let barangayId: string;
  let categoryId: string;
  let customerId: string;
  let workerId: string;
  let customerUserId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(testApp.prisma);
    const barangay = await createBarangay(testApp.prisma);
    const category = await createCategory(testApp.prisma);
    barangayId = barangay.id;
    categoryId = category.id;

    const { profile: customerProfile, user: customerUser } =
      await createCustomer(testApp.prisma);
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    customerId = customerProfile.id;
    workerId = workerProfile.id;
    customerUserId = customerUser.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  const baseBooking = () => ({
    customerId,
    workerId,
    categoryId,
    barangayId,
  });

  it('cancels only the genuinely stale, unreviewed ACCEPTED booking', async () => {
    const staleAccepted = await createBooking(testApp.prisma, {
      ...baseBooking(),
      status: BookingStatus.ACCEPTED,
      scheduledDate: new Date(Date.now() - THREE_DAYS_MS),
    });

    const recentAccepted = await createBooking(testApp.prisma, {
      ...baseBooking(),
      status: BookingStatus.ACCEPTED,
      // default scheduledDate is +24h — window end is in the future, not stale
    });

    const staleUnderReview = await createBooking(testApp.prisma, {
      ...baseBooking(),
      status: BookingStatus.ACCEPTED,
      scheduledDate: new Date(Date.now() - THREE_DAYS_MS),
    });
    await testApp.prisma.noShowReport.create({
      data: {
        bookingId: staleUnderReview.id,
        reportedBy: customerUserId,
        reportType: NoShowReportType.WORKER,
      },
    });

    const staleNonAccepted = await createBooking(testApp.prisma, {
      ...baseBooking(),
      status: BookingStatus.COMPLETED,
      scheduledDate: new Date(Date.now() - THREE_DAYS_MS),
    });

    const cron = testApp.app.get(BookingsCron);
    await cron.cancelStaleAcceptedBookings();

    const [b1, b2, b3, b4] = await Promise.all([
      testApp.prisma.booking.findUnique({ where: { id: staleAccepted.id } }),
      testApp.prisma.booking.findUnique({ where: { id: recentAccepted.id } }),
      testApp.prisma.booking.findUnique({ where: { id: staleUnderReview.id } }),
      testApp.prisma.booking.findUnique({ where: { id: staleNonAccepted.id } }),
    ]);

    expect(b1?.status).toBe(BookingStatus.CANCELLED);
    expect(b1?.cancellationActor).toBe(CancellationActor.SYSTEM);
    expect(b1?.cancellationReason).toBe(STALE_CANCEL_REASON);
    expect(b1?.cancelledAt).not.toBeNull();

    expect(b2?.status).toBe(BookingStatus.ACCEPTED);
    expect(b3?.status).toBe(BookingStatus.ACCEPTED);
    expect(b4?.status).toBe(BookingStatus.COMPLETED);
  });

  it('issues no strike when auto-cancelling', async () => {
    await createBooking(testApp.prisma, {
      ...baseBooking(),
      status: BookingStatus.ACCEPTED,
      scheduledDate: new Date(Date.now() - THREE_DAYS_MS),
    });

    const cron = testApp.app.get(BookingsCron);
    await cron.cancelStaleAcceptedBookings();

    const strikes = await testApp.prisma.strike.count({ where: { workerId } });
    expect(strikes).toBe(0);
  });
});
