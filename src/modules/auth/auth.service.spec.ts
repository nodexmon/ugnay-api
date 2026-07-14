import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { AuthService } from '@/modules/auth/auth.service';
import { jwtConfig } from '@/config';

const mockJwtConfig = {
  JWT_SECRET: 'test-secret-at-least-32-chars-long',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_REGISTRATION_EXPIRES_IN: '15m',
};

const activeUser = {
  id: 'user-id',
  phone: '+639171234567',
  role: Role.WORKER,
  status: UserStatus.ACTIVE,
};

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
    signRegistrationToken: jest.fn(),
    verifyRegistrationToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtService.signTokens.mockReturnValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    jwtService.signRegistrationToken.mockReturnValue('reg-token');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpService, useValue: otpService },
        { provide: SmsService, useValue: smsService },
        { provide: AuthJwtService, useValue: jwtService },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
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

  describe('verifyOtp', () => {
    it('returns login result for existing active user', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyOtp('+639171234567', '123456');

      expect(result).toEqual({
        type: 'login',
        accessToken: 'access',
        refreshToken: 'refresh',
      });
      expect(jwtService.signTokens).toHaveBeenCalledWith(
        'user-id',
        '+639171234567',
        Role.WORKER,
        expect.any(String),
      );
    });

    it('returns registration token for new user', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.verifyOtp('+639171234567', '123456');

      expect(result).toEqual({ type: 'registration', registrationToken: 'reg-token' });
      expect(jwtService.signRegistrationToken).toHaveBeenCalledWith('+639171234567');
      expect(jwtService.signTokens).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for inactive user', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.verifyOtp('+639171234567', '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    it('creates user and issues auth tokens', async () => {
      jwtService.verifyRegistrationToken.mockResolvedValue({
        sub: '+639171234567',
        purpose: 'registration',
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(activeUser);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register('reg-token', Role.WORKER);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { phone: '+639171234567', role: Role.WORKER },
      });
      expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    });

    it('throws ConflictException if phone already registered', async () => {
      jwtService.verifyRegistrationToken.mockResolvedValue({
        sub: '+639171234567',
        purpose: 'registration',
      });
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(service.register('reg-token', Role.WORKER)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws UnauthorizedException for invalid registration token', async () => {
      jwtService.verifyRegistrationToken.mockRejectedValue(
        new UnauthorizedException('Invalid registration token'),
      );

      await expect(service.register('bad-token', Role.WORKER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
