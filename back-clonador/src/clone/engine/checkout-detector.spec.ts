import { detectCheckouts } from './checkout-detector';
import { parseHtml } from './html-rewriter';

const page = (body: string) => parseHtml(`<html><body>${body}</body></html>`);

describe('detectCheckouts', () => {
  it('não acha nada numa página sem checkout', () => {
    const $ = page('<a href="https://exemplo.com/sobre">Sobre</a>');
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(0);
    expect(report.platforms).toHaveLength(0);
  });

  it('acha o checkout da Hotmart e extrai o código do produto', () => {
    const $ = page('<a href="https://pay.hotmart.com/B12345678?off=abc">Comprar</a>');
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0]).toMatchObject({
      platform: 'hotmart',
      platformName: 'Hotmart',
      productId: 'B12345678',
      where: 'link',
    });
    expect(report.platforms).toEqual(['hotmart']);
  });

  it('reconhece Kiwify, Braip, Eduzz e Monetizze', () => {
    const $ = page(`
      <a href="https://pay.kiwify.com.br/aB3xYz">Kiwify</a>
      <a href="https://ev.braip.com/checkout/pla9k2">Braip</a>
      <a href="https://sun.eduzz.com/123456">Eduzz</a>
      <a href="https://app.monetizze.com.br/checkout/ABC12">Monetizze</a>
    `);
    const report = detectCheckouts($);
    expect(report.platforms.sort()).toEqual(['braip', 'eduzz', 'kiwify', 'monetizze']);
  });

  it('pega checkout em <form action> também', () => {
    const $ = page('<form action="https://pay.hotmart.com/B99?checkout=1"><button>Pagar</button></form>');
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0].where).toBe('form');
  });

  it('não repete a mesma URL achada duas vezes', () => {
    const $ = page(`
      <a href="https://pay.hotmart.com/B12345678">Comprar agora</a>
      <a href="https://pay.hotmart.com/B12345678">Comprar no rodapé</a>
    `);
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(1);
  });

  it('ignora links que não são de checkout', () => {
    const $ = page(`
      <a href="https://hotmart.com/pt-br/blog/artigo">Blog da Hotmart</a>
      <a href="mailto:contato@exemplo.com">E-mail</a>
      <a href="/relativo">Interno</a>
    `);
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(0);
  });

  it('acha vários produtos distintos da mesma plataforma', () => {
    const $ = page(`
      <a href="https://pay.hotmart.com/B111">Produto 1</a>
      <a href="https://pay.hotmart.com/B222">Produto 2</a>
    `);
    const report = detectCheckouts($);
    expect(report.matches).toHaveLength(2);
    expect(report.matches.map((m) => m.productId)).toEqual(['B111', 'B222']);
    expect(report.platforms).toEqual(['hotmart']);
  });
});
