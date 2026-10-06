import { parseHtml } from './html-rewriter';
import { replacePixels } from './pixel-replacer';

describe('replacePixels', () => {
  it('troca o ID do Meta Pixel no script inline', () => {
    const $ = parseHtml(`<html><head><script>fbq('init','111111111111111');</script></head><body></body></html>`);
    const report = replacePixels($, [{ from: '111111111111111', to: '999999999999999' }]);
    expect(report.replaced).toBe(1);
    expect($.html()).toContain('999999999999999');
    expect($.html()).not.toContain('111111111111111');
  });

  it('troca o ID do GA4 no src e no inline de uma vez', () => {
    const $ = parseHtml(`
      <html><head>
        <script src="https://www.googletagmanager.com/gtag/js?id=G-OLD12345A"></script>
        <script>gtag('config','G-OLD12345A');</script>
      </head><body></body></html>`);
    const report = replacePixels($, [{ from: 'G-OLD12345A', to: 'G-NEW67890B' }]);
    expect(report.replaced).toBe(2);
    expect($.html()).not.toContain('G-OLD12345A');
  });

  it('troca o ID na imagem do noscript do Meta', () => {
    const $ = parseHtml(
      '<html><body><noscript><img src="https://www.facebook.com/tr?id=123123123123123&ev=PageView"/></noscript></body></html>',
    );
    const report = replacePixels($, [{ from: '123123123123123', to: '456456456456456' }]);
    expect(report.replaced).toBe(1);
    expect($.html()).toContain('id=456456456456456');
  });

  it('ignora regras vazias ou iguais', () => {
    const $ = parseHtml(`<html><head><script>fbq('init','111');</script></head><body></body></html>`);
    expect(replacePixels($, [{ from: '', to: 'x' }]).replaced).toBe(0);
    expect(replacePixels($, [{ from: '111', to: '111' }]).replaced).toBe(0);
  });

  it('não mexe no conteúdo visível da página', () => {
    const $ = parseHtml(
      `<html><head><script>fbq('init','555');</script></head><body><p>Ligue 555 agora</p></body></html>`,
    );
    replacePixels($, [{ from: '555', to: '777' }]);
    expect($('p').text()).toBe('Ligue 555 agora');
  });
});
