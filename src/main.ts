import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? false });

  app.useLogger(app.get(Logger));

  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
