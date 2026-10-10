import { buildInlinePreview } from './preview-inliner';
import { DownloadedAsset } from './types';

const asset = (path: string, contentType: string, body: string): DownloadedAsset => ({
  url: `https://origem/${path}`,
  path,
  contentType,
  body: Buffer.from(body),
});

describe('buildInlinePreview', () => {
  it('embute imagem como data: URI', () => {
    const html = '<html><body><img src="assets/abc.png"></body></html>';
    const out = buildInlinePreview(html, [asset('assets/abc.png', 'image/png', 'PNGDATA')]);
    expect(out).toContain('data:image/png;base64,');
    expect(out).not.toContain('assets/abc.png');
  });

  it('transforma <link> css em <style> com url() resolvido', () => {
    const html = '<html><head><link rel="stylesheet" href="assets/s.css"></head><body></body></html>';
    const css = 'body{background:url(assets/bg.png)}';
    const out = buildInlinePreview(html, [
      asset('assets/s.css', 'text/css', css),
      asset('assets/bg.png', 'image/png', 'BG'),
    ]);
    expect(out).toContain('<style>');
    expect(out).not.toContain('<link');
    expect(out).toContain('url(data:image/png;base64,');
  });

  it('não duplica o doctype', () => {
    const html = '<!DOCTYPE html><html><body>oi</body></html>';
    const out = buildInlinePreview(html, []);
    expect(out.toLowerCase().match(/<!doctype/g)?.length ?? 0).toBe(1);
  });

  it('deixa intactos os assets que não baixaram', () => {
    const html = '<html><body><img src="assets/sumiu.png"></body></html>';
    const out = buildInlinePreview(html, []);
    expect(out).toContain('assets/sumiu.png');
  });
});
