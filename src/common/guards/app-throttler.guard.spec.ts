import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;

  beforeEach(() => {
    guard = new AppThrottlerGuard({} as any, {} as any, new Reflector());
  });

  it('uses the authenticated user sub as the throttle tracker key', async () => {
    const req = { user: { sub: 'user-abc' }, ip: '1.2.3.4' } as any;
    await expect((guard as any).getTracker(req)).resolves.toBe('user-abc');
  });

  it('falls back to IP when request has no authenticated user', async () => {
    const req = { user: undefined, ip: '1.2.3.4' } as any;
    await expect((guard as any).getTracker(req)).resolves.toBe('1.2.3.4');
  });

  it('returns empty string when neither user nor IP is present', async () => {
    const req = { user: undefined, ip: undefined } as any;
    await expect((guard as any).getTracker(req)).resolves.toBe('');
  });
});
