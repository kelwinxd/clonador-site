import { parseHtml } from './html-rewriter';
import { detectPixels } from './pixel-detector';

const page = (head: string) => parseHtml(`<html><head>${head}</head><body><h1>Oferta</h1></body></html>`);

describe('detectPixels', () => {
  it('não acha nada numa página sem rastreamento', () => {
    const $ = page('<script>console.log("oi")</script>');
    expect(detectPixels($).matches).toHaveLength(0);
  });

  it('acha o Meta Pixel pelo fbq init', () => {
    const $ = page(`<script>fbq('init', '1234567890123456'); fbq('track','PageView');</script>`);
    const m = detectPixels($).matches;
    expect(m).toEqual([{ platform: 'meta', platformName: 'Meta Pixel', id: '1234567890123456' }]);
  });

  it('acha o Meta Pixel pela imagem do noscript', () => {
    const $ = parseHtml(
      '<html><body><noscript><img src="https://www.facebook.com/tr?id=998877665544332&ev=PageView"/></noscript></body></html>',
    );
    expect(detectPixels($).matches[0]).toMatchObject({ platform: 'meta', id: '998877665544332' });
  });

  it('acha GA4 e GTM', () => {
    const $ = page(`
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4"></script>
      <script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-ABCD12');</script>
    `);
    const ids = detectPixels($).matches.map((m) => `${m.platform}:${m.id}`);
    expect(ids).toContain('ga4:G-ABC123DEF4');
    expect(ids).toContain('gtm:GTM-ABCD12');
  });

  it('acha o TikTok Pixel', () => {
    const $ = page(`<script>ttq.load('CABC1234DEF5678GHIJ');</script>`);
    expect(detectPixels($).matches[0]).toMatchObject({ platform: 'tiktok', id: 'CABC1234DEF5678GHIJ' });
  });

  it('acha o Universal Analytics antigo', () => {
    const $ = page(`<script>ga('create', 'UA-12345678-1', 'auto');</script>`);
    expect(detectPixels($).matches[0]).toMatchObject({ platform: 'ua', id: 'UA-12345678-1' });
  });

  it('não repete o mesmo ID', () => {
    const $ = page(`<script>fbq('init','111222333444555');fbq('init','111222333444555');</script>`);
    expect(detectPixels($).matches).toHaveLength(1);
  });
});
