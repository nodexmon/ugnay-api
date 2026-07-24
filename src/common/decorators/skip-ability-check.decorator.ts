import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_ABILITY_CHECK_KEY = 'skipAbilityCheck';
export const SkipAbilityCheck = (): CustomDecorator =>
  SetMetadata(SKIP_ABILITY_CHECK_KEY, true);
