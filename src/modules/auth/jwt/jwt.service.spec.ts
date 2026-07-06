import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthJwtService } from '@/modules/auth/jwt/jwt.service';
import { jwtConfig } from '@/config';

const mockJwtConfig = {
  JWT_SECRET: 'test-secret-at-least-32-chars-long',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
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

    expect(service.signTokens('user-id', '+639171234567', 'WORKER', 'token-id')).toEqual({
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
      { sub: 'user-id', phone: '+639171234567', role: 'WORKER', tokenId: 'token-id' },
      { expiresIn: mockJwtConfig.JWT_REFRESH_EXPIRES_IN },
    );
  });

  it('rejects refresh tokens without token id', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-id', phone: '+639171234567', role: 'WORKER' });

    await expect(service.verifyRefreshToken('refresh')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
