import { Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Queue, QueueEvents } from 'bullmq';
import type { Server, Socket } from 'socket.io';
import { QUEUE } from '../config';
import { CloneJobData, CloneProgress } from './clone.types';
import { CloneJobResult, parseFailedReason } from './clone.worker';
import { CLONE_QUEUE, redisConnection } from './queue.provider';

/**
 * Progresso em tempo real, uma sala por job.
 *
 * Em vez de o worker empurrar direto no socket, ouvimos o QueueEvents do BullMQ, que
 * publica progresso/conclusão/falha pelo Redis. Assim funciona mesmo quando o worker virar
 * um processo separado da API (Etapa 18): quem emite e quem escuta não precisam ser o mesmo.
 *
 * O cliente conecta, manda `subscribe` com o id do job e entra na sala daquele id. Como ele
 * pode chegar depois de o job já ter andado, ao entrar mandamos o estado atual na hora.
 */
@WebSocketGateway({
  cors: { origin: (o, cb) => cb(null, !o || /^http:\/\/localhost:\d+$/.test(o)) },
})
export class CloneGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(CloneGateway.name);
  private queueEvents?: QueueEvents;

  @WebSocketServer() private server!: Server;

  constructor(@Inject(CLONE_QUEUE) private readonly queue: Queue<CloneJobData>) {}

  afterInit(): void {
    this.queueEvents = new QueueEvents(QUEUE.name, { connection: redisConnection() });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      this.server.to(jobId).emit('progress', data as CloneProgress);
    });
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.server.to(jobId).emit('done', returnvalue as unknown as CloneJobResult);
    });
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      const falha = parseFailedReason(failedReason);
      this.server.to(jobId).emit('failed', { code: falha.code, message: falha.message });
    });

    this.logger.log('gateway de progresso pronto');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents?.close();
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @MessageBody() jobId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!jobId || typeof jobId !== 'string') return;
    await client.join(jobId);
    await this.enviarEstadoAtual(jobId, client);
  }

  /** Para quem conecta depois: dispara o evento que corresponde ao estado atual do job. */
  private async enviarEstadoAtual(jobId: string, client: Socket): Promise<void> {
    const job = await this.queue.getJob(jobId).catch(() => null);
    if (!job) return;

    const state = await job.getState();
    if (state === 'completed') {
      client.emit('done', job.returnvalue as CloneJobResult);
    } else if (state === 'failed') {
      const falha = parseFailedReason(job.failedReason);
      client.emit('failed', { code: falha.code, message: falha.message });
    } else if (job.progress) {
      client.emit('progress', job.progress as CloneProgress);
    }
  }
}
