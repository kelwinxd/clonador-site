import { CheerioDoc, PixelReplaceReport, PixelRule } from './types';

/**
 * Troca os IDs de pixel pelo ID do afiliado.
 *
 * Os IDs vivem no texto dos <script> (inline ou no src) e na imagem do <noscript> do Meta.
 * A troca é uma substituição literal do token do ID — esses IDs (G-…, GTM-…, 16 dígitos do
 * Meta, hash do TikTok) são distintos o bastante para não colidir com outro texto da página,
 * e mexemos só em <script>, <img> e <iframe>, nunca no conteúdo visível.
 */
export function replacePixels($: CheerioDoc, rules: PixelRule[]): PixelReplaceReport {
  const validas = rules.filter((r) => r.from.trim() && r.to.trim() && r.from !== r.to);
  if (validas.length === 0) return { replaced: 0 };

  let replaced = 0;

  const trocar = (texto: string): string => {
    let saida = texto;
    for (const regra of validas) {
      const partes = saida.split(regra.from);
      if (partes.length > 1) {
        replaced += partes.length - 1;
        saida = partes.join(regra.to);
      }
    }
    return saida;
  };

  $('script').each((_, el) => {
    const node = $(el);
    const inner = node.html();
    if (inner) node.html(trocar(inner));
    const src = node.attr('src');
    if (src) node.attr('src', trocar(src));
  });

  $('img[src], iframe[src]').each((_, el) => {
    const node = $(el);
    const src = node.attr('src');
    if (src) node.attr('src', trocar(src));
  });

  // O conteúdo de <noscript> é texto cru para o cheerio (a imagem do pixel do Meta mora aqui),
  // então o seletor de <img> acima não o alcança — troca no texto.
  $('noscript').each((_, el) => {
    const node = $(el);
    const inner = node.html();
    if (inner) node.html(trocar(inner));
  });

  return { replaced };
}
