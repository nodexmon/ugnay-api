import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { IS_PUBLIC_KEY } from '@/common/decorators/public-endpoint.decorator';
import { CHECK_ABILITY_KEY } from '@/common/decorators/check-ability.decorator';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './casl.guard';
import { Action } from './casl.types';

const workerUser = { sub: 'user-id', phone: '', role: Role.WORKER };

const makeContext = (user: unknown, isPublic: unknown, required: unknown): ExecutionContext => ({
  getHandler: () => ({}),
  getClass: () => ({}),
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
} as unknown as ExecutionContext);

describe('CaslGuard', () => {
  let guard: CaslGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaslGuard,
        CaslAbilityFactory,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<CaslGuard>(CaslGuard);
    reflector = module.get(Reflector);
  });

  const setMetadata = (isPublic: boolean | undefined, required: unknown) => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === CHECK_ABILITY_KEY) return required;
      return undefined;
    });
  };

  it('allows access to public routes regardless of user or ability', () => {
    setMetadata(true, undefined);
    const ctx = makeContext(undefined, true, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when no @CheckAbility decorator is present', () => {
    setMetadata(undefined, undefined);
    const ctx = makeContext(workerUser, undefined, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when no user is attached to the request', () => {
    setMetadata(undefined, { action: Action.Read, subject: 'Booking' });
    const ctx = makeContext(undefined, undefined, { action: Action.Read, subject: 'Booking' });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows access when the user has the required ability', () => {
    setMetadata(undefined, { action: Action.Read, subject: 'Booking' });
    const ctx = makeContext(workerUser, undefined, { action: Action.Read, subject: 'Booking' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when the user lacks the required ability', () => {
    setMetadata(undefined, { action: Action.Create, subject: 'Booking' });
    const ctx = makeContext(workerUser, undefined, { action: Action.Create, subject: 'Booking' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
