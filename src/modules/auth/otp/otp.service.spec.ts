import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { OTP_MAX_VERIFY_ATTEMPTS } from './otp.constants';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedvalue'),
  compare: jest.fn(),
}));

describe('OtpService', () => {
  let service: OtpService;
  const prisma = {
    otpRequest: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.otpRequest.count.mockResolvedValue(0);
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('createOtp', () => {
    it('throws 429 when 5 or more OTPs have been sent to the same phone in the last hour', async () => {
      prisma.otpRequest.count.mockResolvedValueOnce(5);

      await expect(service.createOtp('+639171234567')).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('creates a six digit OTP and stores only its bcrypt hash', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedvalue');
      prisma.otpRequest.create.mockImplementation(
        ({ data }: { data: { codeHash: string } }) =>
          Promise.resolve({ id: 'otp-id', ...data }),
      );

      const { id, code } = await service.createOtp('+639171234567');

      expect(id).toBe('otp-id');
      expect(code).toMatch(/^\d{6}$/);
      expect(bcrypt.hash).toHaveBeenCalledWith(code, expect.any(Number));
      expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith({
        where: { phone: '+639171234567', verified: false },
        data: { expiresAt: expect.any(Date) },
      });
      const createArg = prisma.otpRequest.create.mock.calls[0][0] as {
        data: { codeHash: string };
      };
      expect(createArg.data.codeHash).toBe('$2b$10$hashedvalue');
      expect(JSON.stringify(createArg)).not.toContain(code);
    });
  });

  describe('verifyOtp', () => {
    const activeOtp = {
      id: 'otp-id',
      codeHash: '$2b$10$hashedvalue',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('marks a matching unexpired OTP as verified', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue(activeOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.otpRequest.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.verifyOtp('+639171234567', '123456')).resolves.toBe(
        true,
      );
      expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'otp-id',
          verified: false,
          attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
        },
        data: { verified: true },
      });
    });

    it('only considers OTPs under the attempt cap', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyOtp('+639171234567', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.otpRequest.findFirst).toHaveBeenCalledWith({
        where: {
          phone: '+639171234567',
          verified: false,
          expiresAt: { gt: expect.any(Date) },
          attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('increments attempts atomically and rejects on a wrong code', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue(activeOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpRequest.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.verifyOtp('+639171234567', '000000'),
      ).rejects.toThrow('Invalid or expired OTP.');
      expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'otp-id',
          verified: false,
          attempts: { lt: OTP_MAX_VERIFY_ATTEMPTS },
        },
        data: { attempts: { increment: 1 } },
      });
    });

    it('rejects a correct code when the verify race is lost (count 0)', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue(activeOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.otpRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.verifyOtp('+639171234567', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('deleteOtp', () => {
    it('deletes the OTP row by id', async () => {
      prisma.otpRequest.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteOtp('otp-id');

      expect(prisma.otpRequest.deleteMany).toHaveBeenCalledWith({
        where: { id: 'otp-id' },
      });
    });
  });
});
