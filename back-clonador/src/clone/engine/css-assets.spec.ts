import { collectCssRefs, isCssAsset, rewriteCss } from './css-assets';

const CSS_URL = 'https://exemplo.com/css/app.css';

describe('collectCssRefs', () => {
  it('acha url(), @import "" e @import url(), resolvendo contra a URL do .css', () => {
    const css = `
      @import "base.css";
      @import url('../vendor/reset.css');
      body { background: url(../img/fundo.png) }
      @font-face { src: url("fonts/x.woff2") format("woff2") }
    `;

    expect(collectCssRefs(css, CSS_URL).sort()).toEqual(
      [
        'https://exemplo.com/css/base.css',
        'https://exemplo.com/vendor/reset.css',
        'https://exemplo.com/img/fundo.png',
        'https://exemplo.com/css/fonts/x.woff2',
      ].sort(),
    );
  });

  it('ignora data: e deixa quem não resolve de fora', () => {
    const css = '.a{background:url("data:image/png;base64,AAAA")}';
    expect(collectCssRefs(css, CSS_URL)).toEqual([]);
  });
});

describe('rewriteCss', () => {
  it('troca url() e @import pelo caminho local, mantendo o que não foi baixado', () => {
    const css = '@import "base.css"; body{background:url(../img/fundo.png)} .x{background:url(/nao-baixado.png)}';
    const toLocal = (absolute: string): string | null => {
      if (absolute.endsWith('/base.css')) return 'aaa.css';
      if (absolute.endsWith('/fundo.png')) return 'bbb.png';
      return null;
    };

    const result = rewriteCss(css, CSS_URL, toLocal);

    expect(result).toContain('@import "aaa.css"');
    expect(result).toContain('url(bbb.png)');
    expect(result).toContain('url(/nao-baixado.png)'); // sem local, fica como estava
  });
});

describe('isCssAsset', () => {
  it.each([
    ['text/css; charset=utf-8', 'assets/a.bin', true],
    ['application/octet-stream', 'assets/a.css', true],
    ['image/png', 'assets/a.png', false],
  ])('content-type %s / path %s -> %s', (contentType, path, esperado) => {
    expect(isCssAsset(contentType, path)).toBe(esperado);
  });
});
