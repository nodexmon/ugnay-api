import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public-endpoint.decorator';
import { SKIP_ABILITY_CHECK_KEY } from '@/common/decorators/skip-ability-check.decorator';
import { AuthJwtPayload } from '@/modules/auth/auth.types';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_ABILITY_KEY,
  RequiredAbility,
} from '@/common/decorators/check-ability.decorator';

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipAbilityCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_ABILITY_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipAbilityCheck) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<
      RequiredAbility | undefined
    >(CHECK_ABILITY_KEY, [context.getHandler(), context.getClass()]);
    if (!required) {
      return false;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthJwtPayload }>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const allowed = ability.can(required.action, required.subject);

    if (!allowed) {
      throw new ForbiddenException(
        `You do not have permission to ${required.action} ${required.subject}.`,
      );
    }

    return true;
  }
}
