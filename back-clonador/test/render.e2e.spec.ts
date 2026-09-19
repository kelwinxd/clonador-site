import AdmZip from 'adm-zip';
import { BrowserService } from '../src/clone/browser.service';
import { CloneService } from '../src/clone/clone.service';
import { CloneError } from '../src/clone/engine/errors';
import { HostChecker, renderPage } from '../src/clone/engine/renderer';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(120_000);

function indexHtml(zip: Buffer): string {
  return new AdmZip(zip).getEntry('index.html')!.getData().toString('utf-8');
}

describe('Etapa 4 — navegador como plano B', () => {
  let fixtures: { url: string; close: () => Promise<void> };
  let browser: BrowserService;
  let service: CloneService;

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_HOSTS = 'true';
    fixtures = await startFixtureServer();
    browser = new BrowserService();
    service = new CloneService(browser);
  });

  afterAll(async () => {
    await browser.close();
    await fixtures.close();
    delete process.env.ALLOW_PRIVATE_HOSTS;
  });

  describe('estratégia híbrida', () => {
    it('página pronta não abre o navegador', async () => {
      const soFetch = new BrowserService();
      const result = await new CloneService(soFetch).clone({ url: `${fixtures.url}/ssr.html` });

      expect(result.meta.mode).toBe('fetch');
      expect(soFetch.launches).toBe(0);
      await soFetch.close();
    });

    it('SPA vazia é renderizada e o clone sai com o conteúdo', async () => {
      const result = await service.clone({
        url: `${fixtures.url}/spa.html`,
        links: [{ from: 'pay.exemplo-checkout.com', to: 'https://go.hotmart.com/MEU-ID' }],
      });
      const html = indexHtml(result.zip);
      const entries = new AdmZip(result.zip).getEntries().map((entry) => entry.entryName);

      expect(result.meta.mode).toBe('render');
      expect(result.meta.reason).toMatch(/#root.*navegador/);
      // Texto que só existe depois do JavaScript rodar.
      expect(html).toContain('Oferta Renderizada por JavaScript');
      // Imagem inserida pelo JS foi achada e baixada.
      expect(html).toMatch(/<img[^>]+src="assets\/[a-f0-9]{10}\.svg"/);
      expect(entries.filter((name) => name.endsWith('.svg')).length).toBeGreaterThanOrEqual(1);
      // Link criado pelo JS também foi trocado.
      expect(result.meta.linksReplaced).toBe(1);
      expect(html).toContain('https://go.hotmart.com/MEU-ID');
    });

    it('tira o script do framework, senão ele monta a página de novo por cima', async () => {
      const result = await service.clone({ url: `${fixtures.url}/spa.html` });
      const html = indexHtml(result.zip);

      expect(result.meta.scriptsRemoved).toBeGreaterThanOrEqual(1);
      expect(html).not.toContain('<script');
    });

    it('forceRender pula o fetch mesmo com a página pronta', async () => {
      const result = await service.clone({ url: `${fixtures.url}/ssr.html`, forceRender: true });

      expect(result.meta.mode).toBe('render');
      expect(result.meta.reason).toMatch(/forçada/);
      expect(indexHtml(result.zip)).toContain('Método Completo de Teste');
    });

    it('fetch recusado com 403 tenta de novo no navegador', async () => {
      const result = await service.clone({ url: `${fixtures.url}/anti-robo.html` });

      expect(result.meta.mode).toBe('render');
      expect(result.meta.reason).toMatch(/403/);
      expect(indexHtml(result.zip)).toContain('Método Completo de Teste');
    });

    it('página que não existe continua sendo erro, sem gastar navegador', async () => {
      const semNavegador = new BrowserService();
      await expect(
        new CloneService(semNavegador).clone({ url: `${fixtures.url}/nao-existe.html` }),
      ).rejects.toMatchObject({ code: 'FETCH_FAILED', httpStatus: 404 });
      expect(semNavegador.launches).toBe(0);
      await semNavegador.close();
    });
  });

  describe('trava de SSRF dentro do navegador', () => {
    // Simula a rede interna: "localhost" é proibido, 127.0.0.1 (a fixture) é "a internet".
    const bloqueiaLocalhost: HostChecker = async (url) => url.hostname !== 'localhost';
    const liberaTudo: HostChecker = async () => true;

    const portaDasFixtures = () => new URL(fixtures.url).port;

    it('controle: sem a trava, o JavaScript da página consegue ler o endereço interno', async () => {
      // Prova que o teste de baixo é de verdade: o ataque funciona quando nada bloqueia.
      const page = await browser.withContext((context) =>
        renderPage(context, `${fixtures.url}/vazamento.html`, { isAllowed: liberaTudo }),
      );
      expect(page.html).toContain('VAZOU: ');
      expect(page.html).toContain('SEGREDO-INTERNO-123');
    });

    it('bloqueia o redirecionamento para a rede interna feito pelo JavaScript da página', async () => {
      const page = await browser.withContext((context) =>
        renderPage(context, `${fixtures.url}/vazamento.html`, { isAllowed: bloqueiaLocalhost }),
      );
      expect(page.html).not.toContain('SEGREDO-INTERNO-123');
      expect(page.html).toContain('BLOQUEADO');
    });

    it('bloqueia a navegação que redireciona para a rede interna', async () => {
      const interno = `http://localhost:${portaDasFixtures()}/segredo.html`;
      const inicio = `${fixtures.url}/redireciona?para=${encodeURIComponent(interno)}`;

      await expect(
        browser.withContext((context) => renderPage(context, inicio, { isAllowed: bloqueiaLocalhost })),
      ).rejects.toMatchObject({ code: 'BLOCKED_HOST' });
    });

    it('segue redirecionamento permitido normalmente', async () => {
      const destino = `${fixtures.url}/ssr.html`;
      const inicio = `${fixtures.url}/redireciona?para=${encodeURIComponent(destino)}`;

      const page = await browser.withContext((context) =>
        renderPage(context, inicio, { isAllowed: bloqueiaLocalhost }),
      );
      expect(page.finalUrl).toBe(destino);
      expect(page.html).toContain('Método Completo de Teste');
    });

    it('recusa a URL inicial da rede interna com a trava padrão', async () => {
      delete process.env.ALLOW_PRIVATE_HOSTS;
      try {
        await expect(
          browser.withContext((context) => renderPage(context, 'http://169.254.169.254/latest/meta-data')),
        ).rejects.toBeInstanceOf(CloneError);
      } finally {
        process.env.ALLOW_PRIVATE_HOSTS = 'true';
      }
    });
  });

  describe('reuso do navegador', () => {
    it('20 clones seguidos usam um navegador só e não deixam contexto aberto', async () => {
      const reuso = new BrowserService();
      const clonador = new CloneService(reuso);
      const memoria: number[] = [];

      for (let rodada = 1; rodada <= 20; rodada++) {
        const result = await clonador.clone({ url: `${fixtures.url}/spa.html` });
        expect(result.meta.mode).toBe('render');
        // Contexto vazado = memória que nunca volta. Tem que ser 0 depois de cada clone.
        expect(reuso.openContexts()).toBe(0);
        memoria.push(process.memoryUsage().rss);
      }

      expect(reuso.launches).toBe(1);

      const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
      console.log(
        `memória do processo Node: rodada 1 = ${mb(memoria[0])} MB, rodada 10 = ${mb(memoria[9])} MB, rodada 20 = ${mb(memoria[19])} MB`,
      );

      await reuso.close();
    });

    it('clones em paralelo também dividem o mesmo navegador', async () => {
      const paralelo = new BrowserService();
      const clonador = new CloneService(paralelo);

      const resultados = await Promise.all(
        Array.from({ length: 5 }, () => clonador.clone({ url: `${fixtures.url}/spa.html` })),
      );

      expect(resultados.every((result) => result.meta.mode === 'render')).toBe(true);
      expect(paralelo.launches).toBe(1);
      expect(paralelo.openContexts()).toBe(0);
      await paralelo.close();
    });
  });
});
