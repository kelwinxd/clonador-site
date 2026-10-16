import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { IP_MAX_CONCURRENT, REDIS_URL } from '../config';

/**
 * Limita quantos clones um mesmo IP pode ter em andamento ao mesmo tempo (na fila ou rodando).
 * Usa um contador no Redis por IP, com TTL de segurança: se um clone travar e não liberar, o
 * contador se cura sozinho ao expirar. Se o Redis estiver fora, NÃO bloqueia (falha-aberta) —
 * a proteção é contra abuso, não deve derrubar o uso legítimo.
 */
@Injectable()
export class IpGuardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpGuardService.name);
  private redis?: Redis;

  onModuleInit(): void {
    try {
      this.redis = new Redis(REDIS_URL, { family: 0, maxRetriesPerRequest: 2 });
      this.redis.on('error', (e) => this.logger.warn(`redis (guard de IP): ${e.message}`));
    } catch (e) {
      this.logger.warn(`sem redis para o guard de IP: ${e instanceof Error ? e.message : e}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  /** Tenta ocupar uma vaga para o IP. false = já está no teto (recuse com 429). */
  async entrar(ip: string): Promise<boolean> {
    if (!this.redis || !ip) return true;
    const chave = `clone:conc:${ip}`;
    try {
      const n = await this.redis.incr(chave);
      if (n === 1) await this.redis.expire(chave, 300); // 5 min de segurança
      if (n > IP_MAX_CONCURRENT) {
        await this.redis.decr(chave);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`guard de IP indisponível, liberando: ${e instanceof Error ? e.message : e}`);
      return true;
    }
  }

  /** Libera a vaga do IP (ao terminar/falhar o clone). */
  async sair(ip: string | undefined): Promise<void> {
    if (!this.redis || !ip) return;
    const chave = `clone:conc:${ip}`;
    try {
      const n = await this.redis.decr(chave);
      if (n <= 0) await this.redis.del(chave);
    } catch {
      // ignora: o TTL limpa depois
    }
  }
}
