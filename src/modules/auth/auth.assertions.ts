import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus } from '@/generated/prisma/enums';
import { RefreshToken, User } from '@/generated/prisma/client';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async findUserForRefresh(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh token.');
    return user;
  }

  assertUserCanAuthenticate(user: User): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive.');
    }
  }

  async findRefreshToken(tokenId: string): Promise<RefreshToken> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });
    if (!token) throw new UnauthorizedException('Invalid refresh token.');
    return token;
  }

  assertTokenIsValid(
    userId: string,
    storedToken: RefreshToken,
    refreshToken: string,
  ): void {
    if (
      storedToken.userId !== userId ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date() ||
      !this.matchesTokenHash(refreshToken, storedToken.tokenHash)
    ) {
      throw new UnauthorizedException('Session is invalid.');
    }
  }

  isTokenReuse(storedToken: RefreshToken, refreshToken: string): boolean {
    return (
      storedToken.revokedAt !== null &&
      this.matchesTokenHash(refreshToken, storedToken.tokenHash)
    );
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private matchesTokenHash(token: string, tokenHash: string): boolean {
    const incomingHash = this.hashToken(token);
    const incomingBuffer = Buffer.from(incomingHash);
    const storedBuffer = Buffer.from(tokenHash);
    return (
      incomingBuffer.length === storedBuffer.length &&
      timingSafeEqual(incomingBuffer, storedBuffer)
    );
  }
}
