import { AuthCron } from '@/modules/auth/auth.cron';
import { createTestApp, TestApp } from './test-app';
import { resetDb, createUser } from './db';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('Auth record retention purge cron (e2e)', () => {
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

  it('purges OTP requests older than 24h and keeps recent ones', async () => {
    const oldOtp = await testApp.prisma.otpRequest.create({
      data: {
        phone: '+639171111111',
        codeHash: 'hash-old',
        expiresAt: new Date(Date.now() - 25 * HOUR_MS),
        createdAt: new Date(Date.now() - 25 * HOUR_MS),
      },
    });
    const recentOtp = await testApp.prisma.otpRequest.create({
      data: {
        phone: '+639172222222',
        codeHash: 'hash-recent',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(Date.now() - HOUR_MS),
      },
    });

    await testApp.app.get(AuthCron).purgeExpiredAuthRecords();

    const survivors = await testApp.prisma.otpRequest.findMany({
      select: { id: true },
    });
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(recentOtp.id);
    expect(
      await testApp.prisma.otpRequest.findUnique({ where: { id: oldOtp.id } }),
    ).toBeNull();
  });

  it('purges refresh tokens expired or revoked >30d and keeps active/recent ones', async () => {
    const user = await createUser(testApp.prisma);

    const expiredOld = await testApp.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'rt-expired-old',
        expiresAt: new Date(Date.now() - 31 * DAY_MS),
      },
    });
    const revokedOld = await testApp.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'rt-revoked-old',
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
        revokedAt: new Date(Date.now() - 31 * DAY_MS),
      },
    });
    const active = await testApp.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'rt-active',
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
      },
    });
    const recentlyRevoked = await testApp.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'rt-revoked-recent',
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
        revokedAt: new Date(Date.now() - DAY_MS),
      },
    });

    await testApp.app.get(AuthCron).purgeExpiredAuthRecords();

    const survivors = await testApp.prisma.refreshToken.findMany({
      select: { id: true },
      orderBy: { tokenHash: 'asc' },
    });
    const survivorIds = survivors.map((t) => t.id);

    expect(survivorIds).toHaveLength(2);
    expect(survivorIds).toEqual(
      expect.arrayContaining([active.id, recentlyRevoked.id]),
    );
    expect(survivorIds).not.toContain(expiredOld.id);
    expect(survivorIds).not.toContain(revokedOld.id);
  });
});
