import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { OtpService } from '@/modules/auth/otp/otp.service';

describe('OtpService', () => {
  let service: OtpService;
  const prisma = {
    otpRequest: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('throws 429 when 5 or more OTPs have been sent to the same phone in the last hour', async () => {
    prisma.otpRequest.count.mockResolvedValueOnce(5);

    await expect(service.createOtp('+639171234567')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('creates a six digit OTP request', async () => {
    const code = await service.createOtp('+639171234567');

    expect(code).toMatch(/^\d{6}$/);
    expect(prisma.otpRequest.updateMany).toHaveBeenCalledWith({
      where: { phone: '+639171234567', verified: false },
      data: { expiresAt: expect.any(Date) },
    });
    expect(prisma.otpRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '+639171234567',
        code,
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('marks a matching unexpired OTP as verified', async () => {
    prisma.otpRequest.findFirst.mockResolvedValue({
      id: 'otp-id',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.verifyOtp('+639171234567', '123456')).resolves.toBe(
      true,
    );
    expect(prisma.otpRequest.update).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
      data: { verified: true },
    });
  });

  it('rejects expired OTPs', async () => {
    prisma.otpRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.verifyOtp('+639171234567', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.otpRequest.findFirst).toHaveBeenCalledWith({
      where: {
        phone: '+639171234567',
        code: '123456',
        verified: false,
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });
});
