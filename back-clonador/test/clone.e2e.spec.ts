import AdmZip from 'adm-zip';
import { BrowserService } from '../src/clone/browser.service';
import { CloneService } from '../src/clone/clone.service';
import { CloneError } from '../src/clone/engine/errors';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(60_000);

describe('CloneService (e2e com fixtures)', () => {
  let fixtures: { url: string; close: () => Promise<void> };
  let browser: BrowserService;
  let service: CloneService;

  beforeAll(async () => {
    // As fixtures rodam em 127.0.0.1: sem isso a trava de SSRF bloqueia (e é para bloquear mesmo).
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

  it('clona a página pronta e devolve um zip com index.html e assets', async () => {
    const result = await service.clone({ url: `${fixtures.url}/ssr.html` });
    const entries = new AdmZip(result.zip).getEntries().map((entry) => entry.entryName);

    expect(entries).toContain('index.html');
    expect(entries).toContain('clone-info.json');
    expect(result.meta.mode).toBe('fetch');
    expect(result.meta.failedAssets).toEqual([]);
    // css + favicon + js + logo + selo + fundo(style) + hero 400 e 800
    expect(result.meta.assets).toBeGreaterThanOrEqual(7);
  });

  it('deixa o HTML apontando só para arquivos locais', async () => {
    const result = await service.clone({ url: `${fixtures.url}/ssr.html` });
    const zip = new AdmZip(result.zip);
    const html = zip.getEntry('index.html')!.getData().toString('utf-8');

    expect(html).not.toContain(fixtures.url);
    expect(html).toMatch(/src="assets\/[a-f0-9]{10}\.svg"/);
    expect(html).toMatch(/href="assets\/[a-f0-9]{10}\.css"/);

    // Todo caminho assets/... citado no HTML existe mesmo dentro do zip.
    const dentroDoZip = new Set(zip.getEntries().map((entry) => entry.entryName));
    const citados = [...html.matchAll(/assets\/[a-f0-9]{10}\.[a-z0-9]+/g)].map((m) => m[0]);
    expect(citados.length).toBeGreaterThan(0);
    for (const caminho of citados) {
      expect(dentroDoZip.has(caminho)).toBe(true);
    }
  });

  it('troca o link de checkout pelo link do afiliado', async () => {
    const result = await service.clone({
      url: `${fixtures.url}/ssr.html`,
      links: [{ from: 'pay.exemplo-checkout.com', to: 'https://pay.exemplo-checkout.com/produto/ABC123?af=meu-id' }],
    });
    const html = new AdmZip(result.zip).getEntry('index.html')!.getData().toString('utf-8');

    expect(result.meta.linksReplaced).toBe(1);
    expect(html).toContain('af=meu-id');
  });

  it('mantém as imagens lazy visíveis sem JavaScript', async () => {
    const result = await service.clone({ url: `${fixtures.url}/lazy.html` });
    const html = new AdmZip(result.zip).getEntry('index.html')!.getData().toString('utf-8');

    expect(html).not.toContain('data:image/gif');
    expect(html).not.toContain('loading="lazy"');
  });

  it('não pede navegador para a página que já vem pronta', async () => {
    const result = await service.clone({ url: `${fixtures.url}/ssr.html` });

    expect(result.meta.renderRecommended).toBe(false);
  });

  it('recusa host da rede interna quando a trava está ligada', async () => {
    delete process.env.ALLOW_PRIVATE_HOSTS;
    await expect(service.clone({ url: 'http://169.254.169.254/latest/meta-data' })).rejects.toThrow(
      CloneError,
    );
    process.env.ALLOW_PRIVATE_HOSTS = 'true';
  });
});
