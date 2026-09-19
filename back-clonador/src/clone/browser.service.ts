import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import pLimit from 'p-limit';
import { Browser, BrowserContext, chromium } from 'playwright';
import { LIMITS, USER_AGENT } from '../config';

/**
 * Dono do navegador. Um Chromium só para a aplicação inteira.
 *
 * Abrir um navegador custa ~1s e centenas de MB; abrir um contexto (uma "janela anônima"
 * dentro dele) custa milissegundos. Então cada clone ganha um contexto novo — cookies e
 * cache isolados entre clientes — e o navegador é reaproveitado.
 *
 * O navegador só sobe no primeiro clone que precisar dele: a maioria das páginas
 * resolve no fetch, e a API não paga essa memória à toa.
 */
@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private readonly slots = pLimit(LIMITS.maxRenderPages);

  /** Quantas vezes o Chromium foi aberto. Com reuso funcionando, fica em 1. */
  launches = 0;

  /** Roda `task` num contexto novo e garante que ele é fechado, dê certo ou não. */
  async withContext<T>(task: (context: BrowserContext) => Promise<T>): Promise<T> {
    return this.slots(async () => {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: 'pt-BR',
        viewport: { width: 1366, height: 900 },
        // Service worker responde requisições sem passar pelo page.route — furaria a trava.
        serviceWorkers: 'block',
      });
      try {
        return await task(context);
      } finally {
        await context.close().catch(() => undefined);
      }
    });
  }

  /** Contextos abertos agora. Tem que voltar a 0 entre clones, senão está vazando memória. */
  openContexts(): number {
    return this.browser?.contexts().length ?? 0;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    await browser?.close().catch(() => undefined);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    // Dois clones chegando juntos não podem abrir dois navegadores.
    if (!this.launching) {
      this.launching = chromium
        .launch({
          headless: true,
          // /dev/shm é pequeno em container e derruba o Chromium (Etapa 9).
          args: ['--disable-dev-shm-usage'],
        })
        .then((browser) => {
          this.launches += 1;
          this.browser = browser;
          this.logger.log(`Chromium aberto (${this.launches}ª vez)`);
          browser.on('disconnected', () => {
            if (this.browser === browser) this.browser = null;
            this.logger.warn('Chromium desconectou; abre de novo no próximo clone');
          });
          return browser;
        })
        .finally(() => {
          this.launching = null;
        });
    }

    return this.launching;
  }
}
