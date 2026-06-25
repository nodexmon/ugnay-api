import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { OtpService } from '@/modules/auth/otp/otp.service';

describe('OtpService', () => {
  let service: OtpService;
  const prisma = {
    otpRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('creates a six digit OTP request', async () => {
    const code = await service.createOtp('+639171234567');

    expect(code).toMatch(/^\d{6}$/);
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

    await expect(service.verifyOtp('+639171234567', '123456')).resolves.toBe(true);
    expect(prisma.otpRequest.update).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
      data: { verified: true },
    });
  });

  it('rejects expired OTPs', async () => {
    prisma.otpRequest.findFirst.mockResolvedValue({
      id: 'otp-id',
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.verifyOtp('+639171234567', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
