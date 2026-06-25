import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@/generated/prisma/enums';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/modules/auth/roles.guard';

const createContext = (user?: { role: Role }) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({ user })),
    })),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: Pick<Reflector, 'getAllAndOverride'>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as Reflector);
  });

  it('allows requests when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows users with a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('denies users without a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext({ role: Role.WORKER }))).toBe(false);
  });

  it('denies anonymous requests when roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext())).toBe(false);
  });

  it('checks handler metadata before controller metadata', () => {
    const context = createContext({ role: Role.ADMIN });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
