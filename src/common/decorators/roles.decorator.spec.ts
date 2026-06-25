import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { Role } from '@/generated/prisma/enums';
import { ROLES_KEY, Roles } from '@/common/decorators/roles.decorator';

describe('Roles decorator', () => {
  it('stores the required roles on a route handler', () => {
    class TestController {
      @Roles(Role.ADMIN, Role.WORKER)
      handler() {
        return undefined;
      }
    }

    const reflector = new Reflector();

    expect(reflector.get(ROLES_KEY, TestController.prototype.handler)).toEqual([
      Role.ADMIN,
      Role.WORKER,
    ]);
  });
});
