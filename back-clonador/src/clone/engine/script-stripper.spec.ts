import { parseHtml } from './html-rewriter';
import { stripFrameworkScripts } from './script-stripper';

const BASE = 'https://exemplo.com/oferta';

describe('stripFrameworkScripts', () => {
  it('remove bundle do framework, script inline comum e dados de hidratação', () => {
    const $ = parseHtml(`
      <html><head>
        <link rel="modulepreload" href="/assets/index-abc.js">
        <link rel="preload" as="script" href="/assets/vendor.js">
        <link rel="preload" as="image" href="/hero.png">
      </head><body>
        <div id="root"><h1>Oferta</h1></div>
        <script type="module" src="/assets/index-abc.js"></script>
        <script>window.__INITIAL_STATE__ = {}</script>
        <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
      </body></html>`);

    const report = stripFrameworkScripts($, BASE);

    expect(report.removed).toBe(3);
    expect($('script')).toHaveLength(0);
    expect($('link[rel="modulepreload"]')).toHaveLength(0);
    expect($('link[as="script"]')).toHaveLength(0);
    // Preload de imagem não é script: fica.
    expect($('link[as="image"]')).toHaveLength(1);
    // O conteúdo renderizado continua.
    expect($('#root h1').text()).toBe('Oferta');
  });

  it('mantém JSON-LD e os pixels de rastreamento', () => {
    const $ = parseHtml(`
      <html><body>
        <script type="application/ld+json">{"@type":"Product"}</script>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-TESTE"></script>
        <script>window.dataLayer = window.dataLayer || []; gtag('config', 'G-TESTE');</script>
        <script>!function(f,b,e,v,n,t,s){}(window); fbq('init', '123456');</script>
        <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
        <script src="/app.js"></script>
      </body></html>`);

    const report = stripFrameworkScripts($, BASE);

    expect(report).toEqual({ removed: 1, kept: 5 });
    expect($.html()).toContain("fbq('init', '123456')");
    expect($.html()).not.toContain('/app.js');
  });
});
