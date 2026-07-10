import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthJwtPayload } from '@/modules/auth/auth.types';
import { Role } from '@/generated/prisma/enums';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  mintToken: (payload: { sub: string; role: Role; phone?: string }) => string;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  const jwtService = app.get(JwtService, { strict: false });
  const prisma = app.get(PrismaService);

  const mintToken = (payload: { sub: string; role: Role; phone?: string }): string => {
    const jwtPayload: AuthJwtPayload = { phone: '', ...payload };
    return jwtService.sign(jwtPayload);
  };

  const close = async () => {
    await prisma.$disconnect();
    await app.close();
  };

  return { app, prisma, mintToken, close };
}
