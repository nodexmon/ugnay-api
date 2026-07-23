import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '@/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(helmet());
  app.enableCors({ origin: config.CORS_ORIGIN ?? false });
  app.enableShutdownHooks();

  app.useLogger(app.get(Logger));

  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (config.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('UGNAY API')
      .setDescription('Two-sided marketplace API for local workers')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.PORT);
}
void bootstrap();
