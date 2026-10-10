import { parseHtml } from './html-rewriter';
import { DownloadedAsset } from './types';

/**
 * Monta um HTML autossuficiente para a PRÉVIA servida pelo backend (Etapa 15).
 *
 * O anônimo vê a prévia, mas não baixa o zip limpo. Então o servidor entrega um único HTML com
 * tudo embutido (assets como data: URIs, .css como <style> com os url() já resolvidos). É o mesmo
 * que o front faz para o "abrir em nova aba", mas aqui no servidor, a partir do HTML final e dos
 * assets que já estão em memória no fim do clone — sem reabrir o zip.
 */
const URL_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

export function buildInlinePreview(html: string, assets: DownloadedAsset[]): string {
  const porCaminho = new Map<string, string>();
  const porNome = new Map<string, string>();
  const cssBruto = new Map<string, string>();

  for (const asset of assets) {
    if (asset.path.endsWith('.css')) {
      cssBruto.set(asset.path, asset.body.toString('utf-8'));
      continue; // css entra como texto em <style>, não como data:
    }
    const dataUri = `data:${asset.contentType};base64,${asset.body.toString('base64')}`;
    porCaminho.set(asset.path, dataUri);
    porNome.set(basename(asset.path), dataUri);
  }

  const resolveUrlCss = (css: string) =>
    css.replace(URL_CSS, (todo, aspas: string, cru: string) => {
      const uri = porCaminho.get(cru) ?? porNome.get(basename(cru));
      return uri ? `url(${aspas}${uri}${aspas})` : todo;
    });

  const cssResolvido = new Map<string, string>();
  for (const [caminho, css] of cssBruto) cssResolvido.set(caminho, resolveUrlCss(css));

  const $ = parseHtml(html);

  // <link rel=stylesheet href=assets/x.css> -> <style>…</style>
  $('link[rel~="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const css = cssResolvido.get(href);
    if (css != null) $(el).replaceWith(`<style>${css}</style>`);
  });

  // src/href simples -> data:
  $('[src], [href]').each((_, el) => {
    for (const attr of ['src', 'href']) {
      const valor = $(el).attr(attr);
      if (valor && porCaminho.has(valor)) $(el).attr(attr, porCaminho.get(valor));
    }
  });

  // srcset -> data:
  $('[srcset]').each((_, el) => {
    const novo = ($(el).attr('srcset') ?? '')
      .split(',')
      .map((parte) => {
        const [u, ...desc] = parte.trim().split(/\s+/);
        const uri = porCaminho.get(u);
        return (uri ?? u) + (desc.length ? ` ${desc.join(' ')}` : '');
      })
      .join(', ');
    $(el).attr('srcset', novo);
  });

  // style="" inline e <style> -> resolve url()
  $('[style]').each((_, el) => {
    $(el).attr('style', resolveUrlCss($(el).attr('style') ?? ''));
  });
  $('style').each((_, el) => {
    const txt = $(el).html();
    if (txt) $(el).html(resolveUrlCss(txt));
  });

  // $.html() já preserva o doctype original (igual ao index.html do zip) — não duplicar.
  return $.html();
}

function basename(caminho: string): string {
  return caminho.split('/').pop() ?? caminho;
}
