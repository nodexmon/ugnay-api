import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthJwtService } from './jwt.service';

describe('AuthJwtService', () => {
  let service: AuthJwtService;
  const jwt = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthJwtService, { provide: JwtService, useValue: jwt }],
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
      { expiresIn: '15m' },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-id', phone: '+639171234567', role: 'WORKER', tokenId: 'token-id' },
      { expiresIn: '30d' },
    );
  });

  it('rejects refresh tokens without token id', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-id', phone: '+639171234567', role: 'WORKER' });

    await expect(service.verifyRefreshToken('refresh')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
