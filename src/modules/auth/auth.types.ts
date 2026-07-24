import { type Role } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';

export interface AuthJwtPayload {
  sub: string;
  phone: string;
  role: Role;
  tokenId?: string;
  iat?: number;
  exp?: number;
}

export interface SignedTokens {
  accessToken: string;
  refreshToken: string;
}

export type RefreshTokenPayload = AuthJwtPayload & {
  tokenId: string;
};

export interface RegistrationTokenPayload {
  sub: string;
  purpose: 'registration';
  otpId: string;
  iat?: number;
  exp?: number;
}

export type VerifyOtpResult =
  | { type: 'login'; accessToken: string; refreshToken: string }
  | { type: 'registration'; registrationToken: string };

export type SessionSummary = Prisma.RefreshTokenGetPayload<{
  select: { id: true; createdAt: true; updatedAt: true };
}>;
