import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/generated/prisma/enums';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const testUser: AuthJwtPayload = {
  sub: 'user-id',
  phone: '+639171234567',
  role: Role.WORKER,
};

@Injectable()
class AttachUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = testUser;
    return true;
  }
}

@Controller('decorator-test')
class TestController {
  @Get('current-user')
  getCurrentUser(@CurrentUser() user: AuthJwtPayload) {
    return user;
  }
}

describe('CurrentUser decorator', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [AttachUserGuard],
    })
      .overrideGuard(AttachUserGuard)
      .useClass(AttachUserGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalGuards(module.get(AttachUserGuard));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the authenticated user from the request', async () => {
    await request(app.getHttpServer())
      .get('/decorator-test/current-user')
      .expect(200)
      .expect(testUser);
  });
});
