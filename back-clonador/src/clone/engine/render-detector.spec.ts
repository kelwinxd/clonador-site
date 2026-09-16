import { parseHtml } from './html-rewriter';
import { needsRender } from './render-detector';

const textoLongo = 'Método completo de vendas online com suporte e garantia. '.repeat(20);

describe('needsRender', () => {
  it('não renderiza quando o HTML já tem conteúdo', () => {
    const $ = parseHtml(`<html><body><h1>Oferta</h1><p>${textoLongo}</p></body></html>`);
    expect(needsRender($).render).toBe(false);
  });

  it('renderiza quando o container do SPA está vazio', () => {
    const $ = parseHtml(`<html><body><div id="root"></div><p>${textoLongo}</p></body></html>`);
    const decision = needsRender($);
    expect(decision.render).toBe(true);
    expect(decision.reason).toContain('#root');
  });

  it('renderiza quando quase não há texto', () => {
    const $ = parseHtml('<html><body><div class="app">carregando...</div></body></html>');
    expect(needsRender($).render).toBe(true);
  });

  it('cita o pedido de JavaScript no motivo', () => {
    const $ = parseHtml(
      '<html><body><noscript>Você precisa habilitar o JavaScript.</noscript></body></html>',
    );
    expect(needsRender($).reason).toMatch(/JavaScript/i);
  });

  it('renderiza quando é muito script para pouco texto', () => {
    const bundle = 'var a=1;'.repeat(3000);
    const $ = parseHtml(`<html><body><p>${textoLongo}</p><script>${bundle}</script></body></html>`);
    expect(needsRender($).render).toBe(true);
  });

  it('não se engana com texto dentro de script ou style', () => {
    const $ = parseHtml(
      `<html><body><style>${textoLongo}</style><script>/* ${textoLongo} */</script><div>oi</div></body></html>`,
    );
    expect(needsRender($).render).toBe(true);
  });
});
