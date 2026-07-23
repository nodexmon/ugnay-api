import { SetMetadata } from '@nestjs/common';

export const SKIP_ABILITY_CHECK_KEY = 'skipAbilityCheck';
export const SkipAbilityCheck = () => SetMetadata(SKIP_ABILITY_CHECK_KEY, true);
