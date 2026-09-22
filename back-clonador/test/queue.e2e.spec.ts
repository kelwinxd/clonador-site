import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import AdmZip from 'adm-zip';
import { BrowserService } from '../src/clone/browser.service';
import { CloneService } from '../src/clone/clone.service';
import { CloneJobResult, CloneWorker } from '../src/clone/clone.worker';
import { cloneQueueProvider } from '../src/clone/queue.provider';
import { ResultStore } from '../src/clone/result-store';
import { REDIS_URL } from '../src/config';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(120_000);

/** Redis pode não estar rodando na máquina; se não estiver, pula a suíte com um aviso. */
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

async function esperarEstado(
  queue: Queue,
  id: string,
  alvo: 'completed' | 'failed',
  limiteMs = 60_000,
): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const job = await queue.getJob(id);
    const estado = job ? await job.getState() : 'unknown';
    if (estado === alvo) return;
    if (estado === 'failed' && alvo === 'completed') {
      throw new Error(`job falhou: ${job?.failedReason}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout esperando estado ${alvo}`);
}

describe('Etapa 6 — fila (BullMQ + Redis)', () => {
  let temRedis = false;
  let queue: Queue;
  let worker: CloneWorker;
  let browser: BrowserService;
  let resultStore: ResultStore;
  let fixtures: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    temRedis = await redisDisponivel();
    if (!temRedis) {
      console.warn('\n[queue.e2e] Redis indisponível em ' + REDIS_URL + ' — suíte pulada.\n');
      return;
    }

    process.env.ALLOW_PRIVATE_HOSTS = 'true';
    fixtures = await startFixtureServer();

    // Mesma fiação do CloneModule, montada na mão (sem Nest) para o teste.
    queue = (cloneQueueProvider as { useFactory: () => Queue }).useFactory();
    browser = new BrowserService();
    resultStore = new ResultStore();
    await resultStore.onModuleInit();
    worker = new CloneWorker(new CloneService(browser), resultStore);
    worker.onModuleInit();

    await queue.drain(); // começa limpo
  });

  afterAll(async () => {
    if (!temRedis) return;
    await worker.onModuleDestroy();
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
    resultStore.onModuleDestroy();
    await browser.close();
    await fixtures.close();
    delete process.env.ALLOW_PRIVATE_HOSTS;
  });

  const teste = (nome: string, fn: () => Promise<void>) =>
    it(nome, async () => {
      if (!temRedis) return;
      await fn();
    });

  teste('processa um clone e disponibiliza o zip para download', async () => {
    const job = await queue.add('clone', { url: `${fixtures.url}/ssr.html` });
    await esperarEstado(queue, String(job.id), 'completed');

    const done = await queue.getJob(String(job.id));
    const result = done!.returnvalue as CloneJobResult;
    expect(result.fileName).toMatch(/\.zip$/);

    expect(await resultStore.exists(String(job.id))).toBe(true);
    const chunks: Buffer[] = [];
    const stream = resultStore.openZip(String(job.id))!;
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c) => chunks.push(c as Buffer));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    const entries = new AdmZip(Buffer.concat(chunks)).getEntries().map((e) => e.entryName);
    expect(entries).toContain('index.html');
  });

  teste('página inexistente termina como failed com o código traduzido', async () => {
    // Com ALLOW_PRIVATE_HOSTS ligado (fixtures), o 404 é o erro determinístico à mão.
    const job = await queue.add('clone', { url: `${fixtures.url}/nao-existe.html` });
    await esperarEstado(queue, String(job.id), 'failed');

    const failed = await queue.getJob(String(job.id));
    const motivo = JSON.parse(failed!.failedReason!);
    expect(motivo.code).toBe('FETCH_FAILED');
    expect(motivo.httpStatus).toBe(404);
  });

  teste('vários clones ao mesmo tempo usam um navegador só', async () => {
    // 6 > maxRenderPages (2), então há fila e reuso de verdade entre jobs concorrentes.
    // (O render.e2e cobre a estabilidade de memória em 20 renders sequenciais.)
    const antes = browser.launches;
    const jobs = await Promise.all(
      Array.from({ length: 6 }, () => queue.add('clone', { url: `${fixtures.url}/spa.html` })),
    );
    await Promise.all(jobs.map((j) => esperarEstado(queue, String(j.id), 'completed', 90_000)));

    // Um Chromium só para todos: no máximo uma abertura ao longo do teste.
    expect(browser.launches - antes).toBeLessThanOrEqual(1);
    expect(browser.openContexts()).toBe(0);
  });
});
