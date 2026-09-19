import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QUEUE } from '../config';
import { CloneMeta } from './clone.service';

export interface StoredResult {
  fileName: string;
  meta: CloneMeta;
}

/**
 * Guarda o .zip de cada clone no disco temporário, com validade.
 *
 * Por que no disco e não no Redis: o zip pode ter dezenas de MB, e o Redis é para dados
 * pequenos e quentes (estado da fila). O job guarda só o resumo; o arquivo fica aqui e é
 * apagado quando vence. No servidor (Etapa 10) isto vira armazenamento externo (R2/S3),
 * porque o disco do Railway some a cada deploy.
 */
@Injectable()
export class ResultStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResultStore.name);
  private readonly dir = join(tmpdir(), 'clonador-resultados');
  private timer?: NodeJS.Timeout;

  async onModuleInit(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // A limpeza roda sozinha; unref para não segurar o processo aberto.
    this.timer = setInterval(() => {
      void this.cleanupExpired();
    }, QUEUE.cleanupEveryMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async save(jobId: string, zip: Buffer, result: StoredResult): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.zipPath(jobId), zip);
    await writeFile(this.metaPath(jobId), JSON.stringify(result), 'utf-8');
  }

  /** Stream do zip para download; null se não existe (nunca gerado ou já expirou). */
  openZip(jobId: string): ReadStream | null {
    try {
      return createReadStream(this.zipPath(jobId));
    } catch {
      return null;
    }
  }

  async exists(jobId: string): Promise<boolean> {
    try {
      await stat(this.zipPath(jobId));
      return true;
    } catch {
      return false;
    }
  }

  /** Apaga arquivos mais velhos que o TTL. Devolve quantos removeu. */
  async cleanupExpired(): Promise<number> {
    const limite = Date.now() - QUEUE.resultTtlMs;
    let removidos = 0;
    let arquivos: string[];
    try {
      arquivos = await readdir(this.dir);
    } catch {
      return 0;
    }

    for (const nome of arquivos) {
      const caminho = join(this.dir, nome);
      try {
        const info = await stat(caminho);
        if (info.mtimeMs < limite) {
          await rm(caminho, { force: true });
          removidos += 1;
        }
      } catch {
        // arquivo sumiu no meio do caminho: ignora
      }
    }

    if (removidos > 0) this.logger.log(`limpeza: ${removidos} arquivos expirados removidos`);
    return removidos;
  }

  private zipPath(jobId: string): string {
    return join(this.dir, `${safe(jobId)}.zip`);
  }

  private metaPath(jobId: string): string {
    return join(this.dir, `${safe(jobId)}.json`);
  }
}

/** jobId vem do BullMQ, mas nunca confie: evita ../ e barra no nome do arquivo. */
function safe(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, '_');
}
