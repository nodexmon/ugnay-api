import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AuthJwtPayload } from './jwt/jwt.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthJwtPayload }>();
    const user = request.user;

    return !!user && roles.includes(user.role as Role);
  }
}
