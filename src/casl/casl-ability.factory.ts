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
        // Worker Profile
        can(Action.Read, 'WorkerProfile');
        can(Action.Create, 'WorkerProfile');
        can(Action.Update, 'WorkerProfile');

        // Verification Doc
        can(Action.Create, 'VerificationDoc');

        // Booking
        can(Action.Read, 'Booking');
        can(Action.Update, 'Booking');

        // Service Category
        can(Action.Read, 'ServiceCategory');

        // Barangay
        can(Action.Read, 'Barangay');

        // Push Token
        can(Action.Create, 'PushToken');
        can(Action.Delete, 'PushToken');
        break;

      case Role.CUSTOMER:
        // Worker Profile
        can(Action.Read, 'WorkerProfile');

        // Customer Profile
        can(Action.Create, 'CustomerProfile');
        can(Action.Read, 'CustomerProfile');
        can(Action.Update, 'CustomerProfile');

        // Booking
        can(Action.Create, 'Booking');
        can(Action.Read, 'Booking');
        can(Action.Update, 'Booking');

        // No-show Report
        can(Action.Create, 'NoShowReport');

        // Review
        can(Action.Create, 'Review');
        can(Action.Read, 'Review');

        // Service Category
        can(Action.Read, 'ServiceCategory');

        // Barangay
        can(Action.Read, 'Barangay');

        // Push Token
        can(Action.Create, 'PushToken');
        can(Action.Delete, 'PushToken');
        break;
    }

    return build();
  }
}
