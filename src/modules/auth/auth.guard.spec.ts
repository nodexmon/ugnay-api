import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public-endpoint.decorator';
import { JwtAuthGuard } from '@/modules/auth/auth.guard';

const createContext = () =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let reflector: Pick<Reflector, 'getAllAndOverride'>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new JwtAuthGuard(reflector as Reflector);
  });

  it('allows public endpoints without delegating to passport', () => {
    const context = createContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const passportCanActivate = jest.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('delegates protected endpoints to the passport jwt guard', () => {
    const context = createContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const passportCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(passportCanActivate).toHaveBeenCalledWith(context);
  });

  it('checks handler metadata before controller metadata', () => {
    const context = createContext();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
