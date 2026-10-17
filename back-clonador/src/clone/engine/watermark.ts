import AdmZip from 'adm-zip';
import { WATERMARK } from '../../config';

/**
 * Marca d'água do plano grátis: um selo fixo no canto do clone, com link de volta para o app.
 * Injetado no download de quem é Free; o Pro baixa limpo. O editor é só do Pro, justamente para
 * o Free não remover o selo pela ferramenta.
 */
function badge(): string {
  const estilo =
    'position:fixed;bottom:14px;right:14px;z-index:2147483647;display:flex;align-items:center;' +
    'gap:6px;background:#0e1520;color:#fff;font:600 12px/1 system-ui,-apple-system,sans-serif;' +
    'text-decoration:none;padding:8px 12px;border-radius:999px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid #f97316';
  return (
    `<a href="${WATERMARK.url}" target="_blank" rel="noopener" ` +
    `data-clone-ninja="marca" style="${estilo}">⚡ Feito com ` +
    `<span style="color:#f97316">Clone Ninja</span></a>`
  );
}

/** Insere o selo antes de </body> (ou no fim, se não houver). */
export function injetarMarcaDaguaHtml(html: string): string {
  const selo = badge();
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${selo}</body>`);
  return html + selo;
}

/** Abre o zip, injeta o selo no index.html e devolve o novo zip. Em erro, devolve o original. */
export function aplicarMarcaDaguaZip(zip: Buffer): Buffer {
  try {
    const arquivo = new AdmZip(zip);
    const index = arquivo.getEntry('index.html');
    if (!index) return zip;
    const html = arquivo.readAsText(index);
    arquivo.updateFile('index.html', Buffer.from(injetarMarcaDaguaHtml(html), 'utf-8'));
    return arquivo.toBuffer();
  } catch {
    return zip;
  }
}
