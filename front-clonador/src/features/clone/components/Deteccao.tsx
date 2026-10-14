import type { CloneMeta } from '../clone.types';

/** Detecção de checkouts/pixels em destaque. "Trocar" leva o item para a configuração (step 2). */
export function Deteccao({
  meta,
  onUsarCheckout,
  onUsarPixel,
}: {
  meta: CloneMeta;
  onUsarCheckout: (url: string) => void;
  onUsarPixel: (id: string) => void;
}) {
  const checkouts = meta.checkouts ?? [];
  const pixels = meta.pixels ?? [];

  if (checkouts.length === 0 && pixels.length === 0) {
    return <div className="deteccao vazia">Nenhum checkout ou pixel conhecido encontrado nesta página.</div>;
  }

  return (
    <div className="deteccao">
      {checkouts.length > 0 && (
        <div className="deteccao-bloco">
          <div className="deteccao-titulo">
            🎯 {checkouts.length === 1 ? '1 checkout encontrado' : `${checkouts.length} checkouts encontrados`}
          </div>
          <ul className="lista-checkouts">
            {checkouts.map((c) => (
              <li key={`${c.where}:${c.url}`}>
                <span className={`tag-plataforma ${c.platform}`}>{c.platformName}</span>
                <code className="checkout-url">{c.url}</code>
                {c.productId && <span className="checkout-id">#{c.productId}</span>}
                <button type="button" className="botao-ghost pequeno" onClick={() => onUsarCheckout(c.url)}>
                  Trocar link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pixels.length > 0 && (
        <div className="deteccao-bloco">
          <div className="deteccao-titulo">
            📊 {pixels.length === 1 ? '1 pixel encontrado' : `${pixels.length} pixels encontrados`}
          </div>
          <ul className="lista-checkouts">
            {pixels.map((p) => (
              <li key={`${p.platform}:${p.id}`}>
                <span className={`tag-plataforma pixel ${p.platform}`}>{p.platformName}</span>
                <code className="checkout-url">{p.id}</code>
                <button type="button" className="botao-ghost pequeno" onClick={() => onUsarPixel(p.id)}>
                  Trocar ID
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="ajuda deteccao-ajuda">
        "Trocar" leva o link/ID para a aba <strong>Configurar</strong> — cole o seu e clone de novo.
      </p>
    </div>
  );
}
