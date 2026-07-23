import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, TestApp } from './test-app';
import { resetDb } from './db';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('OTP attempt cap (e2e)', () => {
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
  const phone = '+639171234567';
  const correctCode = '123456';

  async function seedOtp(attempts = 0) {
    return testApp.prisma.otpRequest.create({
      data: {
        phone,
        codeHash: sha256(correctCode),
        attempts,
        verified: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  }

  it('returns 401 with the correct code after 5 failed attempts', async () => {
    await seedOtp(5);

    await request(server())
      .post('/auth/verify-otp')
      .send({ phone, code: correctCode })
      .expect(401);
  });

  it('succeeds on the correct code before the attempt cap is reached', async () => {
    await seedOtp(0);

    await request(server())
      .post('/auth/verify-otp')
      .send({ phone, code: correctCode })
      .expect(200);
  });

  it('increments the attempt counter and returns 401 on a wrong code', async () => {
    await seedOtp(0);

    await request(server())
      .post('/auth/verify-otp')
      .send({ phone, code: '000000' })
      .expect(401);

    const row = await testApp.prisma.otpRequest.findFirst({ where: { phone } });
    expect(row?.attempts).toBe(1);
  });

  it('locks out on the 5th wrong attempt so the correct code on the 6th call returns 401', async () => {
    await seedOtp(0);

    for (let i = 0; i < 5; i++) {
      await request(server())
        .post('/auth/verify-otp')
        .send({ phone, code: '000000' })
        .expect(401);
    }

    await request(server())
      .post('/auth/verify-otp')
      .send({ phone, code: correctCode })
      .expect(401);
  });
});
