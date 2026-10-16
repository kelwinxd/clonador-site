import { Injectable, Logger } from '@nestjs/common';
import { RECAPTCHA } from '../config';

const SITE_VERIFY = 'https://www.google.com/recaptcha/api/siteverify';

interface SiteVerifyResponse {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verifica o token do reCAPTCHA v3 com o Google. Opcional: sem RECAPTCHA_SECRET, a verificação
 * é pulada (dev). Falha de infraestrutura (Google fora) NÃO bloqueia — o limite por IP ainda
 * protege de abuso; só bloqueamos quando o Google diz explicitamente que é robô.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  get ativo(): boolean {
    return !!RECAPTCHA.secret;
  }

  async verificar(token: string | undefined, ip?: string): Promise<boolean> {
    if (!this.ativo) return true; // desligado em desenvolvimento
    if (!token) return false;

    try {
      const params = new URLSearchParams({ secret: RECAPTCHA.secret, response: token });
      if (ip) params.set('remoteip', ip);

      const resp = await fetch(SITE_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = (await resp.json()) as SiteVerifyResponse;

      if (!data.success) {
        this.logger.warn(`reCAPTCHA recusou: ${(data['error-codes'] ?? []).join(', ') || 'sem detalhe'}`);
        return false;
      }
      if (typeof data.score === 'number' && data.score < RECAPTCHA.minScore) {
        this.logger.warn(`reCAPTCHA com nota baixa: ${data.score}`);
        return false;
      }
      return true;
    } catch (e) {
      // Infra do Google fora: não derruba o produto (o limite por IP continua valendo).
      this.logger.warn(`falha ao verificar reCAPTCHA, liberando: ${e instanceof Error ? e.message : e}`);
      return true;
    }
  }
}
