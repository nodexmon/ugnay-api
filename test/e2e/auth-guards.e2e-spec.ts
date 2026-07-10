import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@/generated/prisma/enums';
import { createTestApp, TestApp } from './test-app';
import { resetDb, createAdmin } from './db';

describe('Auth & guard chain (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(testApp.prisma);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const server = () => testApp.app.getHttpServer() as App;

  it('returns 401 when no token is provided', async () => {
    await request(server()).get('/users/me').expect(401);
  });

  it('returns 401 when the token is signed with the wrong secret', async () => {
    const fakeToken = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid';
    await request(server())
      .get('/users/me')
      .set('Authorization', fakeToken)
      .expect(401);
  });

  it('returns 200 on a @Public route without a token', async () => {
    await request(server()).get('/barangays').expect(200);
  });

  it('returns 403 when a customer accesses an admin route', async () => {
    const user = await testApp.prisma.user.create({
      data: { phone: '+639111111111', role: Role.CUSTOMER },
    });
    const token = testApp.mintToken({ sub: user.id, role: Role.CUSTOMER });

    await request(server())
      .get('/admin/verifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 403 when a worker tries to create a booking (customer-only)', async () => {
    const user = await testApp.prisma.user.create({
      data: { phone: '+639222222222', role: Role.WORKER },
    });
    const token = testApp.mintToken({ sub: user.id, role: Role.WORKER });

    await request(server())
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('returns 200 when an admin accesses an admin route', async () => {
    const admin = await createAdmin(testApp.prisma);
    const token = testApp.mintToken({ sub: admin.id, role: Role.ADMIN });

    await request(server())
      .get('/admin/verifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
