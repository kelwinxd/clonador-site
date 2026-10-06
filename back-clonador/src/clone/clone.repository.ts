import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloneMeta } from './types';

/** O que registrar quando um clone conclui ou falha. */
export interface RegistroClone {
  jobId: string;
  url: string;
  status: 'completed' | 'failed';
  errorCode?: string;
  fileName?: string;
  meta?: CloneMeta;
}

/**
 * Histórico de clones no banco. O registro é "melhor esforço": se o banco estiver fora,
 * a gente loga e segue — o clone em si não depende disso.
 */
@Injectable()
export class CloneRepository {
  private readonly logger = new Logger(CloneRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(dados: RegistroClone): Promise<void> {
    try {
      await this.prisma.clone.create({
        data: {
          jobId: dados.jobId,
          url: dados.url,
          status: dados.status,
          errorCode: dados.errorCode,
          fileName: dados.fileName,
          finalUrl: dados.meta?.finalUrl,
          mode: dados.meta?.mode,
          assets: dados.meta?.assets ?? 0,
          totalBytes: dados.meta?.totalBytes ?? 0,
          linksReplaced: dados.meta?.linksReplaced ?? 0,
        },
      });
    } catch (error) {
      this.logger.warn(`não registrei o clone no banco: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** Últimos clones (histórico). */
  async recentes(limite = 50) {
    try {
      return await this.prisma.clone.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 200),
      });
    } catch {
      return [];
    }
  }
}
