import { Injectable } from '@nestjs/common';
import { CREDITOS } from '../config';
import { PrismaService } from '../prisma/prisma.service';

export interface EstadoCreditos {
  plano: string;
  usados: number;
  /** Teto do ciclo; null = ilimitado (Pro). */
  limite: number | null;
  /** Quantos ainda podem ser usados; null = ilimitado. */
  restantes: number | null;
}

/**
 * Cota de clones por usuário. Login é obrigatório para clonar; cada clone com sucesso gasta 1
 * crédito. O ciclo reseta sozinho a cada CREDITOS.cicloDias. Pro é ilimitado.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Zera o contador se o ciclo venceu. Devolve o usuário atualizado. */
  private async aplicarCiclo(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const venceEm = user.cicloReset.getTime() + CREDITOS.cicloDias * 86_400_000;
    if (Date.now() > venceEm) {
      return this.prisma.user.update({
        where: { id: userId },
        data: { creditosUsados: 0, cicloReset: new Date() },
      });
    }
    return user;
  }

  async estado(userId: string): Promise<EstadoCreditos | null> {
    const user = await this.aplicarCiclo(userId);
    if (!user) return null;
    if (user.plano === 'pro') {
      return { plano: 'pro', usados: user.creditosUsados, limite: null, restantes: null };
    }
    const limite = CREDITOS.freePorCiclo;
    return {
      plano: user.plano,
      usados: user.creditosUsados,
      limite,
      restantes: Math.max(0, limite - user.creditosUsados),
    };
  }

  /** Pode clonar agora? (Pro sempre pode; Free só com crédito no ciclo.) */
  async podeClonar(userId: string): Promise<boolean> {
    const e = await this.estado(userId);
    if (!e) return false;
    return e.restantes === null || e.restantes > 0;
  }

  /** Marca 1 clone como usado (chamado no sucesso). Best-effort. */
  async consumir(userId: string | undefined): Promise<void> {
    if (!userId) return;
    await this.prisma.user
      .update({ where: { id: userId }, data: { creditosUsados: { increment: 1 } } })
      .catch(() => undefined);
  }
}
