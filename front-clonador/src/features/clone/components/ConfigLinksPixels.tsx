import { SecaoTitulo } from '@/shared/ui/primitives';
import { useClone } from '../CloneContext';
import type { LinkRule, PixelRule } from '../clone.types';

/**
 * Step 2 do resultado: configurar as trocas de link (checkout) e de pixel, já sabendo o que a
 * página tem (a detecção preenche estes campos). "Clonar de novo" refaz o clone com as trocas.
 */
export function ConfigLinksPixels({ onReclonar }: { onReclonar: () => void }) {
  const app = useClone();

  function atualizarLink(indice: number, campo: keyof LinkRule, valor: string) {
    app.setLinks((atual) => atual.map((l, p) => (p === indice ? { ...l, [campo]: valor } : l)));
  }
  function atualizarPixel(indice: number, campo: keyof PixelRule, valor: string) {
    app.setPixels((atual) => atual.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));
  }

  return (
    <div className="painel painel-config">
      <p className="ajuda">
        Agora que você já viu a página, configure as trocas. Use os botões "Trocar" da prévia para
        trazer os links e pixels detectados para cá — depois cole o seu e clone de novo.
      </p>

      <SecaoTitulo numero={1} titulo="Links (checkout)" />
      {app.links.map((link, indice) => (
        <div className="linha-link" key={indice}>
          <input
            value={link.from}
            onChange={(e) => atualizarLink(indice, 'from', e.target.value)}
            placeholder="pay.hotmart.com/B123…"
          />
          <span className="seta" aria-hidden="true">
            →
          </span>
          <input
            type="url"
            value={link.to}
            onChange={(e) => atualizarLink(indice, 'to', e.target.value)}
            placeholder="https://go.hotmart.com/…"
          />
          <button
            type="button"
            className="botao-icone"
            aria-label={`Remover troca ${indice + 1}`}
            onClick={() => app.setLinks((a) => a.filter((_, p) => p !== indice))}
            disabled={app.links.length === 1}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="botao-ghost"
        onClick={() => app.setLinks((a) => [...a, { from: '', to: '' }])}
      >
        + Link
      </button>

      <SecaoTitulo numero={2} titulo="Pixels" />
      {app.pixels.map((pixel, indice) => (
        <div className="linha-link" key={indice}>
          <input
            value={pixel.from}
            onChange={(e) => atualizarPixel(indice, 'from', e.target.value)}
            placeholder="G-ABC123 / 16 dígitos…"
          />
          <span className="seta" aria-hidden="true">
            →
          </span>
          <input
            value={pixel.to}
            onChange={(e) => atualizarPixel(indice, 'to', e.target.value)}
            placeholder="seu ID"
          />
          <button
            type="button"
            className="botao-icone"
            aria-label={`Remover pixel ${indice + 1}`}
            onClick={() => app.setPixels((a) => a.filter((_, p) => p !== indice))}
            disabled={app.pixels.length === 1}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="botao-ghost"
        onClick={() => app.setPixels((a) => [...a, { from: '', to: '' }])}
      >
        + Pixel
      </button>

      <button type="button" className="cta" onClick={onReclonar}>
        CLONAR DE NOVO COM AS TROCAS
      </button>
    </div>
  );
}
