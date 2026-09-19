import AdmZip from 'adm-zip';
import { BrowserService } from '../src/clone/browser.service';
import { CloneService } from '../src/clone/clone.service';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(60_000);

/** Toda referência local (no HTML e dentro dos .css) tem que existir dentro do zip. */
function referenciasQuebradas(zip: AdmZip): string[] {
  const dentro = new Set(zip.getEntries().map((entry) => entry.entryName));
  const quebradas: string[] = [];

  const html = zip.getEntry('index.html')!.getData().toString('utf-8');
  for (const ref of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
    if (!dentro.has(ref[1])) quebradas.push(`html -> ${ref[1]}`);
  }

  for (const entry of zip.getEntries()) {
    if (!entry.entryName.endsWith('.css')) continue;
    const css = entry.getData().toString('utf-8');
    // Dentro do css os caminhos são irmãos (só o nome do arquivo).
    for (const ref of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const alvo = ref[1];
      if (/^(data|https?):/i.test(alvo)) continue;
      if (!dentro.has(`assets/${alvo}`)) quebradas.push(`${entry.entryName} -> ${alvo}`);
    }
    for (const ref of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      if (!dentro.has(`assets/${ref[1]}`)) quebradas.push(`${entry.entryName} @import ${ref[1]}`);
    }
  }

  return quebradas;
}

describe('Etapa 5 — assets dentro do CSS', () => {
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

  it('puxa o @import, a fonte e o fundo que estavam só dentro do styles.css', async () => {
    const zip = new AdmZip((await service.clone({ url: `${fixtures.url}/ssr.html` })).zip);
    const nomes = zip.getEntries().map((entry) => entry.entryName);

    const temExtensao = (ext: string) => nomes.some((nome) => nome.endsWith(ext));
    expect(nomes.filter((nome) => nome.endsWith('.css')).length).toBeGreaterThanOrEqual(2); // styles + fontes
    expect(temExtensao('.woff2')).toBe(true); // fonte, referenciada dentro de fontes.css
    // fundo.svg e selo.svg vêm de url() (css e style inline).
    expect(nomes.filter((nome) => nome.endsWith('.svg')).length).toBeGreaterThanOrEqual(5);
  });

  it('o styles.css baixado aponta para arquivos locais, sem URL absoluta', async () => {
    const zip = new AdmZip((await service.clone({ url: `${fixtures.url}/ssr.html` })).zip);
    const css = zip
      .getEntries()
      .filter((entry) => entry.entryName.endsWith('.css'))
      .map((entry) => entry.getData().toString('utf-8'))
      .join('\n');

    expect(css).not.toContain(fixtures.url);
    // @import url("hash.css") — a fixture usa a forma com url(), também reescrita.
    expect(css).toMatch(/@import url\(['"]?[a-f0-9]{10}\.css['"]?\)/);
    expect(css).toMatch(/url\(['"]?[a-f0-9]{10}\.woff2['"]?\)/); // fonte reescrita (com ou sem aspas)
  });

  it('nenhuma referência local aponta para fora do zip (sem 404)', async () => {
    const zip = new AdmZip((await service.clone({ url: `${fixtures.url}/ssr.html` })).zip);
    expect(referenciasQuebradas(zip)).toEqual([]);
  });
});
