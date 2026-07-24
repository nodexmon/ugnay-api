import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const sub = (req.user as { sub?: string } | undefined)?.sub;
    return Promise.resolve(sub ?? (req.ip as string | undefined) ?? '');
  }
}
