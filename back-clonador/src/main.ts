import 'dotenv/config'; // carrega o .env antes de qualquer coisa ler process.env
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import IORedis from 'ioredis';
import { AppModule } from './app.module';
import { REDIS_URL } from './config';

/**
 * A fila (Etapa 6) precisa do Redis. Sem essa checagem, um Redis fora do ar vira um
 * stack trace cru do ioredis na largada. Aqui a mensagem diz o que fazer.
 */
async function assertRedis(): Promise<void> {
  const client = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  client.on('error', () => {}); // sem isso o ioredis imprime o erro cru antes da nossa mensagem
  try {
    await client.connect();
    await client.ping();
  } catch {
    const logger = new Logger('Bootstrap');
    logger.error(`Não consegui falar com o Redis em ${REDIS_URL}.`);
    logger.error('Suba o Redis antes do backend:  docker compose up -d');
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

async function bootstrap() {
  await assertRedis();

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
