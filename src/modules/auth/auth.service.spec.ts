import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { OtpService } from '@/modules/auth/otp/otp.service';
import { SmsService } from '@/modules/auth/sms/sms.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthAssertions } from '@/modules/auth/auth.assertions';
import { Logger } from 'nestjs-pino';
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

  const authAssertions = {
    assertUserCanAuthenticate: jest.fn(),
    findUserForRefresh: jest.fn(),
    findRefreshToken: jest.fn(),
    assertTokenIsValid: jest.fn(),
    isTokenReuse: jest.fn().mockReturnValue(false),
    hashToken: jest.fn().mockReturnValue('hashed-token'),
  };

  const logger = { warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

  const otpService = {
    createOtp: jest.fn(),
    verifyOtp: jest.fn(),
    deleteOtp: jest.fn(),
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
    authAssertions.hashToken.mockReturnValue('hashed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthAssertions, useValue: authAssertions },
        { provide: OtpService, useValue: otpService },
        { provide: SmsService, useValue: smsService },
        { provide: AuthJwtService, useValue: jwtService },
        { provide: Logger, useValue: logger },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('sends an OTP through SMS', async () => {
    otpService.createOtp.mockResolvedValue({ id: 'otp-id', code: '123456' });

    await service.sendOtp('+639171234567');

    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+639171234567',
      'Your OTP code is 123456. Do not share this to anyone.',
    );
    expect(otpService.deleteOtp).not.toHaveBeenCalled();
  });

  it('deletes the OTP and rethrows when the SMS send fails', async () => {
    otpService.createOtp.mockResolvedValue({ id: 'otp-id', code: '123456' });
    otpService.deleteOtp.mockResolvedValue(undefined);
    smsService.sendSms.mockRejectedValue(
      new ServiceUnavailableException(
        'SMS service is temporarily unavailable. Please try again later.',
      ),
    );

    await expect(service.sendOtp('+639171234567')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(otpService.deleteOtp).toHaveBeenCalledWith('otp-id');
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

      expect(result).toEqual({
        type: 'registration',
        registrationToken: 'reg-token',
      });
      expect(jwtService.signRegistrationToken).toHaveBeenCalledWith(
        '+639171234567',
      );
      expect(jwtService.signTokens).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for inactive user', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });
      authAssertions.assertUserCanAuthenticate.mockImplementationOnce(() => {
        throw new UnauthorizedException('Account is inactive.');
      });

      await expect(
        service.verifyOtp('+639171234567', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });

    it('throws ConflictException if phone already registered', async () => {
      jwtService.verifyRegistrationToken.mockResolvedValue({
        sub: '+639171234567',
        purpose: 'registration',
      });
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        service.register('reg-token', Role.WORKER),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws UnauthorizedException for invalid registration token', async () => {
      jwtService.verifyRegistrationToken.mockRejectedValue(
        new UnauthorizedException('Invalid registration token'),
      );

      await expect(
        service.register('bad-token', Role.WORKER),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refreshToken — reuse detection', () => {
    const storedToken = {
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'hashed-token',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    beforeEach(() => {
      jwtService.verifyRefreshToken.mockResolvedValue({
        sub: 'user-id',
        tokenId: 'token-id',
      });
      authAssertions.findUserForRefresh.mockResolvedValue(activeUser);
      authAssertions.findRefreshToken.mockResolvedValue(storedToken);
    });

    it('revokes all sessions and throws 401 when a previously rotated token is replayed', async () => {
      authAssertions.isTokenReuse.mockReturnValue(true);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refreshToken('old-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('does not revoke sessions when the token is merely expired (not reuse)', async () => {
      authAssertions.isTokenReuse.mockReturnValue(false);
      authAssertions.assertTokenIsValid.mockImplementation(() => {
        throw new UnauthorizedException('Session is invalid.');
      });

      await expect(
        service.refreshToken('expired-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
