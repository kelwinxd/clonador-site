import 'dotenv/config'; // carrega o .env antes de qualquer coisa ler process.env
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import IORedis from 'ioredis';
import { AppModule } from './app.module';
import { REDIS_URL, corsOrigin } from './config';

/**
 * A fila (Etapa 6) precisa do Redis. Sem essa checagem, um Redis fora do ar vira um
 * stack trace cru do ioredis na largada. Aqui a mensagem diz o que fazer.
 */
async function assertRedis(): Promise<void> {
  // family: 0 = IPv4/IPv6 (a rede interna do Railway é IPv6).
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    family: 0,
  });
  client.on('error', () => {}); // sem isso o ioredis imprime o erro cru antes da nossa mensagem
  try {
    await client.connect();
    await client.ping();
  } catch {
    const logger = new Logger('Bootstrap');
    logger.error(`Não consegui falar com o Redis em ${REDIS_URL}.`);
    logger.error('Redis fora do ar ou REDIS_URL errado. No Railway: adicione o Redis e aponte REDIS_URL para ${{Redis.REDIS_URL}}. Local: docker compose up -d');
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

async function bootstrap() {
  await assertRedis();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: corsOrigin(),
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
