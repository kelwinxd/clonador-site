import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente do banco (Prisma) como serviço do Nest.
 * Conecta ao subir e desconecta ao desligar.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('conectado ao Postgres');
    } catch (error) {
      // Banco é secundário (histórico): sem ele o clone ainda funciona.
      this.logger.warn(`sem conexão com o banco: ${error instanceof Error ? error.message : error}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }
}
