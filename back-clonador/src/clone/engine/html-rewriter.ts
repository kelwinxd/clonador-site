import * as cheerio from 'cheerio';

export type CheerioDoc = cheerio.CheerioAPI;

/** Atributos simples que apontam para um arquivo. */
const URL_ATTRIBUTES: Array<{ selector: string; attr: string }> = [
  { selector: 'img', attr: 'src' },
  { selector: 'img', attr: 'data-src' },
  { selector: 'img', attr: 'data-lazy-src' },
  { selector: 'img', attr: 'data-original' },
  { selector: 'source', attr: 'src' },
  { selector: 'video', attr: 'src' },
  { selector: 'video', attr: 'poster' },
  { selector: 'audio', attr: 'src' },
  { selector: 'script', attr: 'src' },
  { selector: 'embed', attr: 'src' },
  { selector: 'object', attr: 'data' },
  { selector: 'input[type="image"]', attr: 'src' },
  { selector: 'link[rel~="stylesheet"]', attr: 'href' },
  { selector: 'link[rel~="icon"]', attr: 'href' },
  { selector: 'link[rel~="shortcut"]', attr: 'href' },
  { selector: 'link[rel~="apple-touch-icon"]', attr: 'href' },
  { selector: 'link[rel~="preload"]', attr: 'href' },
];

/** Atributos com lista de imagens em tamanhos diferentes. */
const SRCSET_ATTRIBUTES: Array<{ selector: string; attr: string }> = [
  { selector: 'img', attr: 'srcset' },
  { selector: 'img', attr: 'data-srcset' },
  { selector: 'source', attr: 'srcset' },
];

const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

export function parseHtml(html: string): CheerioDoc {
  return cheerio.load(html);
}

/**
 * Transforma um caminho da página em URL absoluta.
 * Devolve null para o que não dá para baixar (data:, javascript:, âncora...).
 */
export function resolveAssetUrl(raw: string | undefined | null, base: string): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.startsWith('#')) return null;
  if (/^(data|javascript|mailto|tel|blob|about|sms|whatsapp|intent):/i.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function parseSrcset(value: string): Array<{ url: string; descriptor: string }> {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, ...rest] = part.split(/\s+/);
      return { url, descriptor: rest.join(' ') };
    });
}

export function serializeSrcset(items: Array<{ url: string; descriptor: string }>): string {
  return items.map((item) => (item.descriptor ? `${item.url} ${item.descriptor}` : item.url)).join(', ');
}

/** Troca as URLs dentro de um CSS (serve para <style>, style="" e, depois, arquivos .css). */
export function rewriteCssUrls(
  css: string,
  base: string,
  map: Map<string, string>,
  pathPrefix = '',
): string {
  return css.replace(CSS_URL_PATTERN, (match, quote: string, raw: string) => {
    const absolute = resolveAssetUrl(raw, base);
    const local = absolute ? map.get(absolute) : undefined;
    return local ? `url(${quote}${pathPrefix}${local}${quote})` : match;
  });
}

export function collectCssUrls(css: string, base: string): string[] {
  const found: string[] = [];
  for (const match of css.matchAll(CSS_URL_PATTERN)) {
    const absolute = resolveAssetUrl(match[2], base);
    if (absolute) found.push(absolute);
  }
  return found;
}

/**
 * Primeira passada: lista tudo que a página precisa baixar.
 * A URL base é a final (pós-redirecionamento), senão os caminhos relativos saem errados.
 */
export function collectAssets($: CheerioDoc, base: string): string[] {
  const urls = new Set<string>();

  for (const { selector, attr } of URL_ATTRIBUTES) {
    $(selector).each((_, element) => {
      const absolute = resolveAssetUrl($(element).attr(attr), base);
      if (absolute) urls.add(absolute);
    });
  }

  for (const { selector, attr } of SRCSET_ATTRIBUTES) {
    $(selector).each((_, element) => {
      const value = $(element).attr(attr);
      if (!value) return;
      for (const item of parseSrcset(value)) {
        const absolute = resolveAssetUrl(item.url, base);
        if (absolute) urls.add(absolute);
      }
    });
  }

  $('style').each((_, element) => {
    for (const url of collectCssUrls($(element).html() ?? '', base)) urls.add(url);
  });

  $('[style]').each((_, element) => {
    for (const url of collectCssUrls($(element).attr('style') ?? '', base)) urls.add(url);
  });

  return [...urls];
}

/**
 * Segunda passada: aponta tudo para os arquivos locais já baixados.
 * `map` liga URL absoluta -> caminho dentro do zip (ex.: assets/ab12cd.png).
 */
export function rewriteAssets($: CheerioDoc, base: string, map: Map<string, string>): void {
  // <base href> quebraria todos os caminhos locais.
  $('base').remove();

  for (const { selector, attr } of URL_ATTRIBUTES) {
    $(selector).each((_, element) => {
      const node = $(element);
      const absolute = resolveAssetUrl(node.attr(attr), base);
      const local = absolute ? map.get(absolute) : undefined;
      if (local) node.attr(attr, local);
    });
  }

  for (const { selector, attr } of SRCSET_ATTRIBUTES) {
    $(selector).each((_, element) => {
      const node = $(element);
      const value = node.attr(attr);
      if (!value) return;
      const items = parseSrcset(value).map((item) => {
        const absolute = resolveAssetUrl(item.url, base);
        const local = absolute ? map.get(absolute) : undefined;
        return local ? { ...item, url: local } : item;
      });
      node.attr(attr, serializeSrcset(items));
    });
  }

  $('style').each((_, element) => {
    const node = $(element);
    node.html(rewriteCssUrls(node.html() ?? '', base, map));
  });

  $('[style]').each((_, element) => {
    const node = $(element);
    node.attr('style', rewriteCssUrls(node.attr('style') ?? '', base, map));
  });

  promoteLazyImages($);
}

/**
 * Imagem com data-src só aparece quando o JS da página roda.
 * Como o clone pode sair sem esses scripts, o valor vira o src de verdade.
 */
function promoteLazyImages($: CheerioDoc): void {
  $('img').each((_, element) => {
    const node = $(element);
    const src = node.attr('src');
    const lazySrc = node.attr('data-src') ?? node.attr('data-lazy-src') ?? node.attr('data-original');
    const isPlaceholder = !src || src.startsWith('data:') || /placeholder|blank|lazy/i.test(src);

    if (lazySrc && isPlaceholder) node.attr('src', lazySrc);

    const lazySrcset = node.attr('data-srcset');
    if (lazySrcset && !node.attr('srcset')) node.attr('srcset', lazySrcset);

    node.removeAttr('loading');
  });
}
