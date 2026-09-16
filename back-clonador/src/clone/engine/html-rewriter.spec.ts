import {
  collectAssets,
  parseHtml,
  parseSrcset,
  resolveAssetUrl,
  rewriteAssets,
  rewriteCssUrls,
} from './html-rewriter';

const BASE = 'https://exemplo.com/oferta/';

describe('resolveAssetUrl', () => {
  it('resolve caminho relativo a partir da URL final', () => {
    expect(resolveAssetUrl('../img/a.png', BASE)).toBe('https://exemplo.com/img/a.png');
  });

  it.each(['data:image/png;base64,AAA', 'javascript:void(0)', '#secao', 'mailto:a@b.com', ''])(
    'ignora %s',
    (raw) => {
      expect(resolveAssetUrl(raw, BASE)).toBeNull();
    },
  );
});

describe('collectAssets', () => {
  it('acha imagem, srcset, css, script, lazy e url() no style', () => {
    const $ = parseHtml(`
      <html><head>
        <link rel="stylesheet" href="/a.css">
        <style>.x { background: url(/fundo.png) }</style>
      </head><body>
        <img src="/foto.jpg" srcset="/foto-400.jpg 400w, /foto-800.jpg 800w">
        <img data-src="/lazy.jpg" src="data:image/gif;base64,AA">
        <div style="background-image:url('/selo.svg')"></div>
        <script src="/app.js"></script>
      </body></html>`);

    const found = collectAssets($, BASE);

    expect(found).toEqual(
      expect.arrayContaining([
        'https://exemplo.com/a.css',
        'https://exemplo.com/fundo.png',
        'https://exemplo.com/foto.jpg',
        'https://exemplo.com/foto-400.jpg',
        'https://exemplo.com/foto-800.jpg',
        'https://exemplo.com/lazy.jpg',
        'https://exemplo.com/selo.svg',
        'https://exemplo.com/app.js',
      ]),
    );
    // data: não vira asset
    expect(found.some((url) => url.startsWith('data:'))).toBe(false);
  });
});

describe('rewriteAssets', () => {
  const map = new Map([
    ['https://exemplo.com/foto.jpg', 'assets/aaa.jpg'],
    ['https://exemplo.com/foto-800.jpg', 'assets/bbb.jpg'],
    ['https://exemplo.com/lazy.jpg', 'assets/ccc.jpg'],
    ['https://exemplo.com/a.css', 'assets/ddd.css'],
  ]);

  it('aponta os atributos para os arquivos locais', () => {
    const $ = parseHtml(`
      <html><head><base href="https://outro.com/"><link rel="stylesheet" href="/a.css"></head>
      <body><img src="/foto.jpg" srcset="/foto-800.jpg 800w"></body></html>`);

    rewriteAssets($, BASE, map);
    const html = $.html();

    expect(html).toContain('assets/ddd.css');
    expect(html).toContain('src="assets/aaa.jpg"');
    expect(html).toContain('assets/bbb.jpg 800w');
    // <base> sai, senão os caminhos locais quebram
    expect(html).not.toContain('<base');
  });

  it('promove data-src para src e tira loading=lazy', () => {
    const $ = parseHtml(
      '<img src="data:image/gif;base64,AA" data-src="/lazy.jpg" loading="lazy">',
    );

    rewriteAssets($, BASE, map);

    expect($('img').attr('src')).toBe('assets/ccc.jpg');
    expect($('img').attr('loading')).toBeUndefined();
  });
});

describe('rewriteCssUrls', () => {
  it('troca url() por caminho local e deixa o resto intacto', () => {
    const map = new Map([['https://exemplo.com/f.woff2', 'assets/f.woff2']]);
    const css = '@font-face{src:url("/f.woff2") format("woff2")} .a{background:url(/nao-baixado.png)}';

    const result = rewriteCssUrls(css, BASE, map);

    expect(result).toContain('url("assets/f.woff2")');
    expect(result).toContain('url(/nao-baixado.png)');
  });
});

describe('parseSrcset', () => {
  it('separa url e descritor', () => {
    expect(parseSrcset('/a.jpg 400w, /b.jpg 2x')).toEqual([
      { url: '/a.jpg', descriptor: '400w' },
      { url: '/b.jpg', descriptor: '2x' },
    ]);
  });
});
