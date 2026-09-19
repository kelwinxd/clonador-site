import { Provider } from '@nestjs/common';
import { ConnectionOptions, Queue } from 'bullmq';
import { REDIS_URL, QUEUE } from '../config';

/** Token de injeção da fila de clones. */
export const CLONE_QUEUE = 'CLONE_QUEUE';

/**
 * Conexão com o Redis compartilhada pela fila e pelo worker.
 * maxRetriesPerRequest: null é exigência do BullMQ (o worker faz comandos bloqueantes).
 */
export function redisConnection(): ConnectionOptions {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/** A fila como provider do Nest, para o controller injetar e enfileirar jobs. */
export const cloneQueueProvider: Provider = {
  provide: CLONE_QUEUE,
  useFactory: () => new Queue(QUEUE.name, { connection: redisConnection() }),
};
