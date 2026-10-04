import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { QUEUE } from '../config';
import { CloneService } from './clone.service';
import { CloneError } from './engine/errors';
import { CloneErrorCode } from './engine/types';
import { CloneJobData, CloneJobResult, SerializedError } from './types';
import { redisConnection } from './queue.provider';
import { ResultStore } from './result-store';

/**
 * Worker da fila: um Worker do BullMQ que pega jobs, roda o clone, guarda o zip no disco
 * e devolve o resumo. A concorrência limita quantos jobs rodam por vez; o navegador tem o
 * próprio teto (BrowserService), então uma rajada de renders não abre navegador demais.
 *
 * Sobe junto com a aplicação (onModuleInit) e fecha no desligamento (onModuleDestroy).
 */
@Injectable()
export class CloneWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloneWorker.name);
  private worker?: Worker<CloneJobData, CloneJobResult>;

  constructor(
    private readonly cloneService: CloneService,
    private readonly resultStore: ResultStore,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<CloneJobData, CloneJobResult>(
      QUEUE.name,
      (job) => this.handle(job),
      { connection: redisConnection(), concurrency: QUEUE.concurrency },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.warn(`job ${job?.id} falhou: ${error.message}`);
    });
    this.logger.log(`worker ouvindo a fila "${QUEUE.name}" (concorrência ${QUEUE.concurrency})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<CloneJobData>): Promise<CloneJobResult> {
    const jobId = String(job.id);

    try {
      const result = await this.cloneService.clone(job.data, (progress) => {
        void job.updateProgress(progress);
      });

      await this.resultStore.save(jobId, result.zip, {
        fileName: result.fileName,
        meta: result.meta,
      });

      return { fileName: result.fileName, meta: result.meta };
    } catch (error) {
      // Guarda o código no failedReason (string), para o status traduzir para o usuário.
      throw new Error(JSON.stringify(serialize(error)));
    }
  }
}

function serialize(error: unknown): SerializedError {
  if (error instanceof CloneError) {
    return { code: error.code, message: error.message, httpStatus: error.httpStatus };
  }
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) };
}

/** Lê de volta o erro serializado; usado pelo controller no status. */
export function parseFailedReason(reason: string | undefined): SerializedError {
  if (!reason) return { code: 'UNKNOWN', message: 'falha desconhecida' };
  try {
    const parsed = JSON.parse(reason) as SerializedError;
    if (parsed && typeof parsed.message === 'string') return parsed;
  } catch {
    // reason não era JSON (erro cru do BullMQ)
  }
  return { code: 'UNKNOWN', message: reason };
}
