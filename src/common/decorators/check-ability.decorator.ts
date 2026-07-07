import { SetMetadata } from '@nestjs/common';
import { Action, Subject } from '@/casl/casl.types';

export const CHECK_ABILITY_KEY = 'check_ability';

export interface RequiredAbility {
  action: Action;
  subject: Subject;
}

export const CheckAbility = (action: Action, subject: Subject) =>
  SetMetadata(CHECK_ABILITY_KEY, { action, subject } satisfies RequiredAbility);
