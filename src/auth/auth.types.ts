import { Role } from "../generated/prisma/enums";

export interface AuthJwtPayload {
  sub: string;
  phone: string;
  role: Role;
  tokenId?: string;
  iat?: number;
  exp?: number;
}