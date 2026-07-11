import request from 'supertest';
import { App } from 'supertest/types';
import {
  BookingStatus,
  Role,
  StrikeReason,
  WorkerStatus,
} from '@/generated/prisma/enums';
import { createTestApp, TestApp } from './test-app';
import {
  resetDb,
  createBarangay,
  createCategory,
  createCustomer,
  createWorker,
  createAdmin,
  createBooking,
} from './db';

describe('No-show report and admin resolution (e2e)', () => {
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

  const server = () => testApp.app.getHttpServer() as App;

  async function setupAcceptedBooking() {
    const { user: customerUser, profile: customerProfile } =
      await createCustomer(testApp.prisma);
    const { user: workerUser, profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const admin = await createAdmin(testApp.prisma);

    const booking = await createBooking(testApp.prisma, {
      customerId: customerProfile.id,
      workerId: workerProfile.id,
      categoryId,
      barangayId,
      status: BookingStatus.ACCEPTED,
    });

    return { customerUser, workerUser, workerProfile, admin, booking };
  }

  it('customer reports a no-show and receives 201', async () => {
    const { customerUser, booking } = await setupAcceptedBooking();
    const token = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Worker did not arrive' })
      .expect(201);

    const report = await testApp.prisma.noShowReport.findUnique({
      where: { bookingId: booking.id },
    });
    expect(report).not.toBeNull();
  });

  it('returns 403 when a customer files a duplicate no-show report', async () => {
    const { customerUser, booking } = await setupAcceptedBooking();
    const token = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('returns 403 when reporting no-show on a PENDING booking', async () => {
    const { user: customerUser, profile: customerProfile } =
      await createCustomer(testApp.prisma);
    const { profile: workerProfile } = await createWorker(
      testApp.prisma,
      barangayId,
    );
    const token = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });

    const pendingBooking = await createBooking(testApp.prisma, {
      customerId: customerProfile.id,
      workerId: workerProfile.id,
      categoryId,
      barangayId,
      status: BookingStatus.PENDING,
    });

    await request(server())
      .post(`/bookings/${pendingBooking.id}/no-show`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('admin confirming a no-show strikes the worker by profile id and marks booking NO_SHOW (regression)', async () => {
    const { customerUser, workerProfile, admin, booking } =
      await setupAcceptedBooking();
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const adminToken = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    const report = await testApp.prisma.noShowReport.findUnique({
      where: { bookingId: booking.id },
    });
    expect(report).not.toBeNull();

    const res = await request(server())
      .patch(`/admin/no-shows/${report!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: true, notes: 'Worker did not show up' })
      .expect(200);

    expect(res.body.resolved).toBe(true);
    expect(res.body.confirmed).toBe(true);

    const updatedBooking = await testApp.prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(updatedBooking?.status).toBe(BookingStatus.NO_SHOW);

    const strike = await testApp.prisma.strike.findFirst({
      where: { workerId: workerProfile.id },
    });
    expect(strike).not.toBeNull();
    expect(strike?.reason).toBe(StrikeReason.NO_SHOW);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.strikeCount).toBe(1);
  });

  it('third confirmed no-show suspends the worker', async () => {
    const { customerUser, workerProfile, admin, booking } =
      await setupAcceptedBooking();
    await testApp.prisma.workerProfile.update({
      where: { id: workerProfile.id },
      data: { strikeCount: 2 },
    });

    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const adminToken = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    const report = await testApp.prisma.noShowReport.findUnique({
      where: { bookingId: booking.id },
    });

    await request(server())
      .patch(`/admin/no-shows/${report!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: true })
      .expect(200);

    const updatedWorker = await testApp.prisma.workerProfile.findUnique({
      where: { id: workerProfile.id },
    });
    expect(updatedWorker?.status).toBe(WorkerStatus.SUSPENDED);
  });

  it('dismissing a no-show creates no strike and leaves booking status unchanged', async () => {
    const { customerUser, workerProfile, admin, booking } =
      await setupAcceptedBooking();
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const adminToken = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    const report = await testApp.prisma.noShowReport.findUnique({
      where: { bookingId: booking.id },
    });

    await request(server())
      .patch(`/admin/no-shows/${report!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: false })
      .expect(200);

    const strikes = await testApp.prisma.strike.findMany({
      where: { workerId: workerProfile.id },
    });
    expect(strikes).toHaveLength(0);

    const updatedBooking = await testApp.prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(updatedBooking?.status).toBe(BookingStatus.ACCEPTED);
  });

  it('returns 409 when resolving an already-resolved report', async () => {
    const { customerUser, admin, booking } = await setupAcceptedBooking();
    const customerToken = testApp.mintToken({
      sub: customerUser.id,
      role: Role.CUSTOMER,
    });
    const adminToken = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .post(`/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    const report = await testApp.prisma.noShowReport.findUnique({
      where: { bookingId: booking.id },
    });

    await request(server())
      .patch(`/admin/no-shows/${report!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: false })
      .expect(200);

    await request(server())
      .patch(`/admin/no-shows/${report!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmed: true })
      .expect(409);
  });
});
