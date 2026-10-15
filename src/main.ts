
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule, ObserveInstrument } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { envConfig } from './config/env.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const allowedOrigins = envConfig.corsOrigins;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(envConfig.port);
}

void bootstrap();
