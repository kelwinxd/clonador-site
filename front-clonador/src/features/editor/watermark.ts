/**
 * Marca d'água no export editado (client-side). O download normal do Free já vem com o selo
 * injetado pelo backend, mas no editor o usuário poderia apagá-lo — então, ao salvar, a gente
 * remove qualquer selo existente e injeta UM, garantindo que o output do Free sempre tenha.
 */
const SELO_REGEX = /<a[^>]*data-clone-ninja="marca"[^>]*>[\s\S]*?<\/a>/gi;

function selo(): string {
  const url = typeof window !== 'undefined' ? window.location.origin : '';
  const estilo =
    'position:fixed;bottom:14px;right:14px;z-index:2147483647;display:flex;align-items:center;' +
    'gap:6px;background:#0e1520;color:#fff;font:600 12px/1 system-ui,-apple-system,sans-serif;' +
    'text-decoration:none;padding:8px 12px;border-radius:999px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid #f97316';
  return (
    `<a href="${url}" target="_blank" rel="noopener" data-clone-ninja="marca" style="${estilo}">` +
    `⚡ Feito com <span style="color:#f97316">Clone Ninja</span></a>`
  );
}

/** Remove selos existentes e injeta um (antes de </body>). Use no export do Free. */
export function injetarMarcaDaguaHtml(html: string): string {
  const limpo = html.replace(SELO_REGEX, '');
  const s = selo();
  if (/<\/body>/i.test(limpo)) return limpo.replace(/<\/body>/i, `${s}</body>`);
  return limpo + s;
}
