import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthAssertions } from './auth.assertions';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus } from '@/generated/prisma/enums';

describe('AuthAssertions', () => {
  let assertions: AuthAssertions;
  const prisma = {
    user: { findUnique: jest.fn() },
    refreshToken: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthAssertions, { provide: PrismaService, useValue: prisma }],
    }).compile();

    assertions = module.get<AuthAssertions>(AuthAssertions);
  });

  describe('findUserForRefresh', () => {
    it('returns the user when found', async () => {
      const user = { id: 'user-id', status: UserStatus.ACTIVE };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await assertions.findUserForRefresh('user-id');

      expect(result).toBe(user);
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        assertions.findUserForRefresh('unknown-id'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('assertUserCanAuthenticate', () => {
    it('does not throw when user is ACTIVE', () => {
      const user = { status: UserStatus.ACTIVE } as any;

      expect(() => assertions.assertUserCanAuthenticate(user)).not.toThrow();
    });

    it('throws UnauthorizedException when user is SUSPENDED', () => {
      const user = { status: UserStatus.SUSPENDED } as any;

      expect(() => assertions.assertUserCanAuthenticate(user)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('findRefreshToken', () => {
    it('returns the token when found', async () => {
      const token = { id: 'token-id', userId: 'user-id' };
      prisma.refreshToken.findUnique.mockResolvedValue(token);

      const result = await assertions.findRefreshToken('token-id');

      expect(result).toBe(token);
    });

    it('throws UnauthorizedException when token does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        assertions.findRefreshToken('unknown-id'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('assertTokenIsValid', () => {
    const validToken = {
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: '',
    } as any;

    beforeEach(() => {
      const rawToken = 'raw-token';
      validToken.tokenHash = assertions.hashToken(rawToken);
    });

    it('does not throw for a valid token', () => {
      const rawToken = 'raw-token';
      validToken.tokenHash = assertions.hashToken(rawToken);

      expect(() =>
        assertions.assertTokenIsValid('user-id', validToken, rawToken),
      ).not.toThrow();
    });

    it('throws when userId does not match', () => {
      const rawToken = 'raw-token';
      validToken.tokenHash = assertions.hashToken(rawToken);

      expect(() =>
        assertions.assertTokenIsValid('other-user-id', validToken, rawToken),
      ).toThrow(UnauthorizedException);
    });

    it('throws when token is revoked', () => {
      const rawToken = 'raw-token';
      const revokedToken = {
        ...validToken,
        revokedAt: new Date(),
        tokenHash: assertions.hashToken(rawToken),
      };

      expect(() =>
        assertions.assertTokenIsValid('user-id', revokedToken, rawToken),
      ).toThrow(UnauthorizedException);
    });

    it('throws when token is expired', () => {
      const rawToken = 'raw-token';
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 1000),
        tokenHash: assertions.hashToken(rawToken),
      };

      expect(() =>
        assertions.assertTokenIsValid('user-id', expiredToken, rawToken),
      ).toThrow(UnauthorizedException);
    });

    it('throws when hash does not match', () => {
      expect(() =>
        assertions.assertTokenIsValid('user-id', validToken, 'wrong-token'),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('hashToken', () => {
    it('returns a deterministic hex string', () => {
      const hash = assertions.hashToken('secret');

      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
      expect(assertions.hashToken('secret')).toBe(hash);
    });

    it('produces different hashes for different inputs', () => {
      expect(assertions.hashToken('a')).not.toBe(assertions.hashToken('b'));
    });
  });
});
