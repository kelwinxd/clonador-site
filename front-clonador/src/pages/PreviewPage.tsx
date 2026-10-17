import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { urlPreview } from '@/features/clone/clone.api';
import { useClone } from '@/features/clone/CloneContext';
import { ConfigLinksPixels } from '@/features/clone/components/ConfigLinksPixels';
import { Deteccao } from '@/features/clone/components/Deteccao';
import { ResumoClone } from '@/features/clone/components/ResumoClone';
import { ROTAS } from '@/shared/constants';
import {
  IconeCelular,
  IconeDesktop,
  IconeDownload,
  IconeLapis,
  IconeOlho,
} from '@/shared/ui/icons';
import { PlaceholderPreview } from '@/shared/ui/primitives';
import { baixarArquivo } from '@/shared/utils';

type Dispositivo = 'desktop' | 'mobile';

/** Página de resultado em dois steps (?step=1 prévia / ?step=2 configurar), compartilhável no reload. */
export default function PreviewPage() {
  const app = useClone();
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dispositivo, setDispositivo] = useState<Dispositivo>('desktop');

  const step = params.get('step') === '2' ? 2 : 1;
  const logado = !!sessao;
  const ehPro = sessao?.plano === 'pro';
  const { resultado, blob, previa, previewUrl, previewSrc, status, erro } = app;

  function irParaStep(s: 1 | 2) {
    setParams(s === 2 ? { step: '2' } : {});
  }
  function aoEditar() {
    if (!sessao) return navigate(ROTAS.criarConta);
    navigate(ROTAS.editor); // editor é livre para todos
  }
  function aoBaixar() {
    if (!resultado) return;
    if (!sessao) return navigate(ROTAS.criarConta);
    if (blob) baixarArquivo(blob, resultado.fileName);
  }
  function trocarCheckout(url: string) {
    app.usarCheckout(url);
    irParaStep(2);
  }
  function trocarPixel(id: string) {
    app.usarPixel(id);
    irParaStep(2);
  }
  function reclonar() {
    app.iniciarClone();
    irParaStep(1);
  }

  // Veio direto na URL sem ter clonado.
  if (status === 'parado' && !resultado) {
    return (
      <div className="painel aviso-vazio">
        <p>Nenhum clone ainda. Comece pelo formulário.</p>
        <button type="button" className="cta pequeno" onClick={() => navigate(ROTAS.clonar)}>
          Ir para o formulário
        </button>
      </div>
    );
  }

  const clonando = status === 'clonando';
  const urlExibida = resultado?.meta.finalUrl ?? app.url;
  const pronto = status === 'pronto' && !!resultado;

  return (
    <div className="resultado-pagina">
      {pronto && (
        <div className="stepper" role="tablist" aria-label="Etapas do resultado">
          <button
            type="button"
            role="tab"
            aria-selected={step === 1}
            className={`stepper-item ${step > 1 ? 'feito' : step === 1 ? 'atual' : 'futuro'}`}
            onClick={() => irParaStep(1)}
          >
            <span className="stepper-circulo">
              {step > 1 ? '✓' : <span className="stepper-dot" />}
            </span>
            <span className="stepper-label">Prévia</span>
          </button>

          <span className={`stepper-linha ${step >= 2 ? 'feita' : ''}`} aria-hidden="true" />

          <button
            type="button"
            role="tab"
            aria-selected={step === 2}
            className={`stepper-item ${step === 2 ? 'atual' : 'futuro'}`}
            onClick={() => irParaStep(2)}
          >
            <span className="stepper-circulo">
              <span className="stepper-dot" />
            </span>
            <span className="stepper-label">Configurar trocas</span>
          </button>
        </div>
      )}

      {erro && status === 'erro' && (
        <div className="erro" role="alert">
          <strong>{erro}</strong>
        </div>
      )}

      {/* STEP 2 — configurar links/pixels */}
      {pronto && step === 2 ? (
        <>
          <Deteccao meta={resultado!.meta} onUsarCheckout={trocarCheckout} onUsarPixel={trocarPixel} />
          <ConfigLinksPixels onReclonar={reclonar} />
        </>
      ) : (
        /* STEP 1 — prévia */
        <div className="painel preview-painel">
          <div className="preview-toolbar">
            <div className="device-toggle" role="group" aria-label="Tamanho da prévia">
              <button
                type="button"
                className={dispositivo === 'desktop' ? 'ativo' : ''}
                onClick={() => setDispositivo('desktop')}
                aria-label="Desktop"
                aria-pressed={dispositivo === 'desktop'}
              >
                <IconeDesktop />
              </button>
              <button
                type="button"
                className={dispositivo === 'mobile' ? 'ativo' : ''}
                onClick={() => setDispositivo('mobile')}
                aria-label="Celular"
                aria-pressed={dispositivo === 'mobile'}
              >
                <IconeCelular />
              </button>
            </div>

            {pronto ? (
              <div className="preview-acoes">
                <button type="button" className="botao-preview ghost" onClick={aoEditar}>
                  <IconeLapis /> Editar
                </button>
                <a
                  className="botao-preview ghost"
                  href={logado ? (previewUrl ?? undefined) : urlPreview(resultado!.id)}
                  target="_blank"
                  rel="noopener"
                >
                  <IconeOlho /> Preview
                </a>
                <button type="button" className="botao-preview pronto" onClick={aoBaixar}>
                  <IconeDownload /> Baixar .zip
                </button>
              </div>
            ) : (
              <span className="botao-preview desativado">
                <IconeOlho /> {clonando ? 'Gerando…' : 'Prévia'}
              </span>
            )}
          </div>

          <div className={`browser-mock ${dispositivo}`}>
            <div className="chrome">
              <span className="dot laranja" />
              <span className="dot" />
              <span className="dot" />
              <div className="url-pill">{urlExibida}</div>
            </div>
            <div className="viewport">
              {previa ? (
                <iframe
                  className="previa-frame"
                  title="Prévia do clone"
                  sandbox="allow-same-origin"
                  srcDoc={previa.html}
                />
              ) : previewSrc ? (
                <iframe
                  className="previa-frame"
                  title="Prévia do clone"
                  sandbox="allow-same-origin"
                  src={previewSrc}
                />
              ) : (
                <PlaceholderPreview clonando={clonando} />
              )}
            </div>
          </div>

          {pronto && (
            <Deteccao
              meta={resultado!.meta}
              onUsarCheckout={trocarCheckout}
              onUsarPixel={trocarPixel}
            />
          )}

          {pronto && !logado && (
            <div className="cta-conta">
              <strong>Gostou?</strong> Crie uma conta para <strong>baixar</strong> o .zip pronto para
              hospedar e <strong>editar</strong> o clone.
              <button type="button" className="cta pequeno" onClick={() => navigate(ROTAS.criarConta)}>
                Criar conta
              </button>
            </div>
          )}

          {pronto && logado && !ehPro && (
            <div className="cta-conta">
              Plano <strong>grátis</strong>: edite à vontade, mas o download sai com marca d'água.{' '}
              <strong>Vire Pro</strong> para baixar limpo (em breve via Stripe).
            </div>
          )}

          {pronto && <ResumoClone meta={resultado!.meta} />}
        </div>
      )}
    </div>
  );
}
