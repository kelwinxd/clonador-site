import { useNavigate } from 'react-router-dom';
import { useApp } from '../state';
import { SecaoTitulo } from '../ui';
import type { LinkRule, PixelRule } from '../types';

/** Página 1: só o formulário de configuração do clone. Ao enviar, vai para /resultado. */
export default function ClonarPage() {
  const app = useApp();
  const navigate = useNavigate();

  function atualizarLink(indice: number, campo: keyof LinkRule, valor: string) {
    app.setLinks((atual) =>
      atual.map((l, p) => (p === indice ? { ...l, [campo]: valor } : l)),
    );
  }
  function atualizarPixel(indice: number, campo: keyof PixelRule, valor: string) {
    app.setPixels((atual) =>
      atual.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)),
    );
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    app.iniciarClone();
    navigate('/resultado');
  }

  return (
    <>
      <p className="tagline">
        Clone uma página autorizada e baixe um <strong>.zip</strong> pronto para hospedar, com o seu
        link no lugar.
      </p>

      <form className="painel painel-form" onSubmit={enviar}>
        <SecaoTitulo numero={1} titulo="Configurar clone" />

        <label className="campo">
          <span className="rotulo">Endereço da página</span>
          <input
            type="url"
            value={app.url}
            onChange={(e) => app.setUrl(e.target.value)}
            placeholder="https://pagina-do-produtor.com/oferta"
            required
          />
        </label>

        <SecaoTitulo numero={2} titulo="Links" />
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

        <SecaoTitulo numero={3} titulo="Pixels" />
        <p className="ajuda">
          Troque o ID de rastreamento (Meta, GA4, GTM, TikTok) pelo seu. Deixe em branco para manter
          o original.
        </p>
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

        <label className="termo">
          <input
            type="checkbox"
            checked={app.termos}
            onChange={(e) => app.setTermos(e.target.checked)}
            required
          />
          <span>Declaro que tenho autorização para clonar esta página.</span>
        </label>

        <button type="submit" className="cta" disabled={!app.termos}>
          CLONAR PÁGINA
        </button>
      </form>
    </>
  );
}
