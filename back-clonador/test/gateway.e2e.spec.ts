import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import IORedis from 'ioredis';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { CloneProgress } from '../src/clone/clone.types';
import { REDIS_URL } from '../src/config';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(60_000);

async function redisDisponivel(): Promise<boolean> {
  const client = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

describe('Etapa 7 — progresso por WebSocket', () => {
  let temRedis = false;
  let app: INestApplication;
  let baseUrl: string;
  let fixtures: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    temRedis = await redisDisponivel();
    if (!temRedis) {
      console.warn('\n[gateway.e2e] Redis indisponível — suíte pulada.\n');
      return;
    }

    process.env.ALLOW_PRIVATE_HOSTS = 'true';
    fixtures = await startFixtureServer();

    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0); // porta livre
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    if (!temRedis) return;
    await app.close();
    await fixtures.close();
    delete process.env.ALLOW_PRIVATE_HOSTS;
  });

  const teste = (nome: string, fn: () => Promise<void>) =>
    it(nome, async () => {
      if (!temRedis) return;
      await fn();
    });

  teste('emite progresso e o resultado final na sala do job', async () => {
    // Enfileira via HTTP.
    const resposta = await fetch(`${baseUrl}/clone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${fixtures.url}/ssr.html`, acceptedTerms: true }),
    });
    const { id } = (await resposta.json()) as { id: string };

    const estagios: CloneProgress['stage'][] = [];
    const done = await new Promise<{ fileName: string }>((resolve, reject) => {
      const socket: Socket = io(baseUrl, { transports: ['websocket'] });
      socket.on('connect', () => socket.emit('subscribe', id));
      socket.on('progress', (p: CloneProgress) => estagios.push(p.stage));
      socket.on('done', (r: { fileName: string }) => {
        socket.disconnect();
        resolve(r);
      });
      socket.on('failed', (e: { message: string }) => {
        socket.disconnect();
        reject(new Error(e.message));
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('timeout esperando o done'));
      }, 30_000);
    });

    expect(done.fileName).toMatch(/\.zip$/);
    // Pelo menos um estágio chegou em tempo real (downloading ou packaging).
    expect(estagios.length).toBeGreaterThan(0);
  });

  teste('quem conecta depois do fim recebe o estado atual na hora', async () => {
    const resposta = await fetch(`${baseUrl}/clone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${fixtures.url}/ssr.html`, acceptedTerms: true }),
    });
    const { id } = (await resposta.json()) as { id: string };

    // Espera o job terminar sem socket (via polling do status).
    await new Promise<void>((resolve, reject) => {
      const inicio = Date.now();
      const tick = async () => {
        const s = await fetch(`${baseUrl}/clone/${id}`).then((r) => r.json());
        if (s.state === 'completed') return resolve();
        if (s.state === 'failed') return reject(new Error('job falhou'));
        if (Date.now() - inicio > 30_000) return reject(new Error('timeout'));
        setTimeout(tick, 300);
      };
      void tick();
    });

    // Só agora conecta: mesmo assim recebe o `done` na entrada.
    const done = await new Promise<{ fileName: string }>((resolve, reject) => {
      const socket: Socket = io(baseUrl, { transports: ['websocket'] });
      socket.on('connect', () => socket.emit('subscribe', id));
      socket.on('done', (r: { fileName: string }) => {
        socket.disconnect();
        resolve(r);
      });
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('não recebeu o estado ao conectar tarde'));
      }, 10_000);
    });

    expect(done.fileName).toMatch(/\.zip$/);
  });
});
