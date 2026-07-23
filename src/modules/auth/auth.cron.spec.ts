import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { AuthCron } from './auth.cron';
import { OTP_RETENTION_MS } from './otp/otp.constants';
import { REFRESH_TOKEN_RETENTION_MS } from './auth.constants';

describe('AuthCron', () => {
  let cron: AuthCron;

  const prisma = {
    otpRequest: { deleteMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
  };

  const logger = { log: jest.fn(), error: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.otpRequest.deleteMany.mockResolvedValue({ count: 0 });
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthCron,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    cron = module.get<AuthCron>(AuthCron);
  });

  it('deletes OTP records older than OTP_RETENTION_MS', async () => {
    prisma.otpRequest.deleteMany.mockResolvedValue({ count: 5 });

    await cron.purgeExpiredAuthRecords();

    const call = prisma.otpRequest.deleteMany.mock.calls[0][0];
    const cutoff: Date = call.where.createdAt.lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      OTP_RETENTION_MS - 1000,
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('5'));
  });

  it('deletes expired and revoked refresh tokens older than REFRESH_TOKEN_RETENTION_MS', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    await cron.purgeExpiredAuthRecords();

    const call = prisma.refreshToken.deleteMany.mock.calls[0][0];
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expiresAt: expect.anything() }),
        expect.objectContaining({ revokedAt: expect.anything() }),
      ]),
    );
    const expiryCutoff: Date = call.where.OR[0].expiresAt.lt;
    expect(Date.now() - expiryCutoff.getTime()).toBeGreaterThanOrEqual(
      REFRESH_TOKEN_RETENTION_MS - 1000,
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('3'));
  });

  it('does not abort the OTP purge when the refresh token purge fails', async () => {
    prisma.otpRequest.deleteMany.mockResolvedValue({ count: 2 });
    prisma.refreshToken.deleteMany.mockRejectedValue(new Error('DB error'));

    await expect(cron.purgeExpiredAuthRecords()).resolves.not.toThrow();

    expect(prisma.otpRequest.deleteMany).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not abort the refresh token purge when the OTP purge fails', async () => {
    prisma.otpRequest.deleteMany.mockRejectedValue(new Error('DB error'));
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    await expect(cron.purgeExpiredAuthRecords()).resolves.not.toThrow();

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
