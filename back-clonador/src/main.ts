import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // Em dev, o Vite pula para 5174, 5175... quando a porta anterior está ocupada.
    // Por isso liberamos qualquer localhost quando CORS_ORIGIN não é definido.
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : /^http:\/\/localhost:\d+$/,
    exposedHeaders: ['X-Clone-Meta', 'Content-Disposition'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Fecha o Chromium quando a API desliga (Ctrl+C, deploy novo).
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`back-clonador em http://localhost:${port}`);
}

void bootstrap();
