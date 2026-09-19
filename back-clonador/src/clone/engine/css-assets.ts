import { resolveAssetUrl } from './html-rewriter';

/**
 * Assets escondidos DENTRO de arquivos .css.
 *
 * O collectAssets acha o `<link href="style.css">`, mas não o que está dentro do style.css:
 * `url(fundo.png)`, `@import "outra.css"`, `@font-face { src: url(fonte.woff2) }`. Sem isso, um
 * clone hospedado abre sem fundo e sem as fontes. Aqui essas referências são achadas e reescritas.
 *
 * Detalhe que importa: a URL base de um `url()` é a do próprio arquivo .css, não a da página.
 * `css/app.css` com `url(../img/x.png)` aponta para `img/x.png`, não para `css/img/x.png`.
 */

// url("x"), url('x'), url(x) — inclusive @font-face e background.
const URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
// @import "x"; e @import 'x'; (a forma @import url(...) já cai no URL_PATTERN).
const IMPORT_PATTERN = /@import\s+(['"])([^'"]+)\1/gi;

/** Lista as URLs absolutas referenciadas por um CSS, resolvidas contra a URL do próprio arquivo. */
export function collectCssRefs(css: string, cssUrl: string): string[] {
  const urls = new Set<string>();
  for (const match of css.matchAll(URL_PATTERN)) {
    const absolute = resolveAssetUrl(match[2], cssUrl);
    if (absolute) urls.add(absolute);
  }
  for (const match of css.matchAll(IMPORT_PATTERN)) {
    const absolute = resolveAssetUrl(match[2], cssUrl);
    if (absolute) urls.add(absolute);
  }
  return [...urls];
}

/**
 * Reescreve as referências de um CSS para os caminhos locais.
 * `toLocal` recebe a URL absoluta e devolve o caminho no zip (ou null se não foi baixada).
 */
export function rewriteCss(
  css: string,
  cssUrl: string,
  toLocal: (absoluteUrl: string) => string | null,
): string {
  const replaced = css.replace(URL_PATTERN, (full, quote: string, raw: string) => {
    const absolute = resolveAssetUrl(raw, cssUrl);
    const local = absolute ? toLocal(absolute) : null;
    return local ? `url(${quote}${local}${quote})` : full;
  });

  return replaced.replace(IMPORT_PATTERN, (full, quote: string, raw: string) => {
    const absolute = resolveAssetUrl(raw, cssUrl);
    const local = absolute ? toLocal(absolute) : null;
    return local ? `@import ${quote}${local}${quote}` : full;
  });
}

/** Um asset é CSS pelo content-type ou pela extensão .css. */
export function isCssAsset(contentType: string, path: string): boolean {
  return /text\/css/i.test(contentType) || /\.css$/i.test(path);
}
