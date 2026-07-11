import request from 'supertest';
import { App } from 'supertest/types';
import { BookingStatus, Role, WorkerStatus } from '@/generated/prisma/enums';
import { createTestApp, TestApp } from './test-app';
import {
  resetDb,
  createBarangay,
  createCategory,
  createCustomer,
  createWorker,
} from './db';

describe('Booking lifecycle (e2e)', () => {
  let testApp: TestApp;
  let barangayId: string;
  let categoryId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const barangay = await createBarangay(testApp.prisma);
    const category = await createCategory(testApp.prisma);
    barangayId = barangay.id;
    categoryId = category.id;
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

  const server = () => testApp.app.getHttpServer() as App;

  it('create → accept → start → complete happy path', async () => {
    const { user: customerUser, profile: customerProfile } =
      await createCustomer(testApp.prisma);
    const { user: workerUser, profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const workerToken = testApp.mintToken({
      sub: workerUser.id,
      role: Role.WORKER,
    });

    // Create
    const createRes = await request(server())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        workerId: workerProfile.id,
        categoryId,
        barangayId,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeWindow: 'MORNING',
        bookingType: 'ON_SITE',
        locationLat: 14.5,
        locationLng: 121.0,
      })
      .expect(201);

    const bookingId = createRes.body.id as string;
    expect(createRes.body.status).toBe(BookingStatus.PENDING);

    // Worker phone not revealed while PENDING
    const pendingView = await request(server())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(pendingView.body.customer?.user).toBeUndefined();

    // Accept
    await request(server())
      .patch(`/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    const accepted = await testApp.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(accepted?.status).toBe(BookingStatus.ACCEPTED);
    expect(accepted?.acceptedAt).not.toBeNull();

    // Start
    await request(server())
      .patch(`/bookings/${bookingId}/start`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    const inProgress = await testApp.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(inProgress?.status).toBe(BookingStatus.IN_PROGRESS);

    // Complete
    await request(server())
      .patch(`/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    const completed = await testApp.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(completed?.status).toBe(BookingStatus.COMPLETED);
    expect(completed?.completedAt).not.toBeNull();
  });

  it('returns 403 when a different worker tries to accept the booking', async () => {
    const { user: customerUser } = await createCustomer(testApp.prisma);
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const { user: otherWorkerUser } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const otherWorkerToken = testApp.mintToken({
      sub: otherWorkerUser.id,
      role: Role.WORKER,
    });

    const createRes = await request(server())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        workerId: workerProfile.id,
        categoryId,
        barangayId,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeWindow: 'MORNING',
        bookingType: 'ON_SITE',
        locationLat: 14.5,
        locationLng: 121.0,
      })
      .expect(201);

    await request(server())
      .patch(`/bookings/${createRes.body.id}/accept`)
      .set('Authorization', `Bearer ${otherWorkerToken}`)
      .expect(403);
  });

  it('returns 403 when trying to start a PENDING booking', async () => {
    const { user: customerUser } = await createCustomer(testApp.prisma);
    const { user: workerUser, profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const workerToken = testApp.mintToken({
      sub: workerUser.id,
      role: Role.WORKER,
    });

    const createRes = await request(server())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        workerId: workerProfile.id,
        categoryId,
        barangayId,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeWindow: 'MORNING',
        bookingType: 'ON_SITE',
        locationLat: 14.5,
        locationLng: 121.0,
      })
      .expect(201);

    await request(server())
      .patch(`/bookings/${createRes.body.id}/start`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
  });

  it('worker cancel at strikeCount 2 suspends the worker and creates a strike', async () => {
    const { user: customerUser } = await createCustomer(testApp.prisma);
    const { user: workerUser, profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
      { strikeCount: 2 },
    );
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const workerToken = testApp.mintToken({
      sub: workerUser.id,
      role: Role.WORKER,
    });

    const createRes = await request(server())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        workerId: workerProfile.id,
        categoryId,
        barangayId,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeWindow: 'MORNING',
        bookingType: 'ON_SITE',
        locationLat: 14.5,
        locationLng: 121.0,
      })
      .expect(201);

    const bookingId = createRes.body.id as string;
    await request(server())
      .patch(`/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    await request(server())
      .patch(`/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ cancellationReason: 'Emergency' })
      .expect(200);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.status).toBe(WorkerStatus.SUSPENDED);

    const strike = await testApp.prisma.strike.findFirst({
      where: { workerId: workerProfile.id },
    });
    expect(strike).not.toBeNull();
  });
});
