import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Role } from '@/generated/prisma/enums';
import { AuthJwtPayload } from '@/modules/auth/auth.types';
import { Action, AppAbility } from './casl.types';

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthJwtPayload): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case Role.ADMIN:
        can(Action.Manage, 'all');
        break;

      case Role.WORKER:
        can(Action.Read, 'WorkerProfile');
        can(Action.Create, 'WorkerProfile');
        can(Action.Update, 'WorkerProfile');
        can(Action.Create, 'VerificationDoc');
        can(Action.Read, 'Booking');
        can(Action.Update, 'Booking');
        can(Action.Read, 'ServiceCategory');
        can(Action.Read, 'Barangay');
        can(Action.Create, 'PushToken');
        can(Action.Delete, 'PushToken');
        break;

      case Role.CUSTOMER:
        can(Action.Read, 'WorkerProfile');
        can(Action.Create, 'CustomerProfile');
        can(Action.Read, 'CustomerProfile');
        can(Action.Update, 'CustomerProfile');
        can(Action.Create, 'Booking');
        can(Action.Read, 'Booking');
        can(Action.Update, 'Booking');
        can(Action.Create, 'NoShowReport');
        can(Action.Create, 'Review');
        can(Action.Read, 'Review');
        can(Action.Read, 'ServiceCategory');
        can(Action.Read, 'Barangay');
        can(Action.Create, 'PushToken');
        can(Action.Delete, 'PushToken');
        break;
    }

    return build();
  }
}
