import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { jwtConfig } from '@/config';

const mockJwtConfig = {
  JWT_SECRET: 'test-secret-at-least-32-chars-long',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_REGISTRATION_EXPIRES_IN: '15m',
};

describe('AuthJwtService', () => {
  let service: AuthJwtService;
  const jwt = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthJwtService,
        { provide: JwtService, useValue: jwt },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
      ],
    }).compile();

    service = module.get<AuthJwtService>(AuthJwtService);
  });

  it('signs access and refresh tokens with role and refresh token id', () => {
    jwt.sign.mockReturnValueOnce('access').mockReturnValueOnce('refresh');

    expect(
      service.signTokens('user-id', '+639171234567', 'WORKER', 'token-id'),
    ).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      { sub: 'user-id', phone: '+639171234567', role: 'WORKER' },
      { expiresIn: mockJwtConfig.JWT_ACCESS_EXPIRES_IN },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      {
        sub: 'user-id',
        phone: '+639171234567',
        role: 'WORKER',
        tokenId: 'token-id',
      },
      { expiresIn: mockJwtConfig.JWT_REFRESH_EXPIRES_IN },
    );
  });

  it('rejects refresh tokens without token id', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      phone: '+639171234567',
      role: 'WORKER',
    });

    await expect(service.verifyRefreshToken('refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('signRegistrationToken signs with purpose claim', () => {
    jwt.sign.mockReturnValue('reg-token');

    expect(service.signRegistrationToken('+639171234567')).toBe('reg-token');
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: '+639171234567', purpose: 'registration' },
      { expiresIn: mockJwtConfig.JWT_REGISTRATION_EXPIRES_IN },
    );
  });

  it('verifyRegistrationToken returns payload for valid token', async () => {
    const payload = { sub: '+639171234567', purpose: 'registration' };
    jwt.verifyAsync.mockResolvedValue(payload);

    await expect(service.verifyRegistrationToken('reg-token')).resolves.toEqual(payload);
  });

  it('verifyRegistrationToken throws for token with wrong purpose', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-id', tokenId: 'tid' });

    await expect(
      service.verifyRegistrationToken('bad-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifyRegistrationToken throws for expired token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      service.verifyRegistrationToken('expired-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
