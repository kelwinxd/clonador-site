import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { BrowserService } from '../src/clone/browser.service';
import { CloneService } from '../src/clone/clone.service';
import { startFixtureServer } from './fixtures/server';

jest.setTimeout(60_000);

function html(zip: Buffer): string {
  return new AdmZip(zip).getEntry('index.html')!.getData().toString('utf-8');
}

describe('Etapa — descongelar animações de entrada', () => {
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

  it('revela o conteúdo das animações de entrada no clone', async () => {
    // forceRender: a página tem HTML, então precisamos do navegador para o descongelamento rodar.
    const result = await service.clone({ url: `${fixtures.url}/animado.html`, forceRender: true });
    const $ = cheerio.load(html(result.zip));

    // Caminho 1 (lib conhecida): ganhou a classe .aos-animate -> o CSS do site o mostra.
    const blocoAos = $('[data-aos]');
    expect(blocoAos.hasClass('aos-animate')).toBe(true);

    // Caminho 2 (reveal genérico): opacity forçada inline para 1.
    const style = ($('.reveal').attr('style') ?? '').replace(/\s/g, '');
    expect(style).toMatch(/opacity:1!important/i);

    // Os dois textos têm que estar no clone.
    expect(html(result.zip)).toContain('Bloco AOS');
    expect(html(result.zip)).toContain('Bloco reveal genérico');
  });
});
