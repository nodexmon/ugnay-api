import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthJwtService } from './jwt/jwt.service';
import { OtpService } from './otp/otp.service';
import { SmsService } from './sms/sms.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const otpService = {
    createOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };
  const smsService = {
    sendSms: jest.fn(),
  };
  const jwtService = {
    signTokens: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtService.signTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpService, useValue: otpService },
        { provide: SmsService, useValue: smsService },
        { provide: AuthJwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('sends an OTP through SMS', async () => {
    otpService.createOtp.mockResolvedValue('123456');

    await service.sendOtp('+639171234567');

    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+639171234567',
      'Your OTP code is 123456. Do not share this to anyone.',
    );
  });

  it('creates a user and issues tokens after OTP verification', async () => {
    otpService.verifyOtp.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      phone: '+639171234567',
      role: Role.WORKER,
    });

    await expect(service.verifyOtp('+639171234567', '123456', Role.WORKER)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    expect(jwtService.signTokens).toHaveBeenCalledWith(
      'user-id',
      '+639171234567',
      Role.WORKER,
      expect.any(String),
    );
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('prevents role changes for an existing phone number', async () => {
    otpService.verifyOtp.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      phone: '+639171234567',
      role: Role.CUSTOMER,
    });

    await expect(service.verifyOtp('+639171234567', '123456', Role.WORKER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
