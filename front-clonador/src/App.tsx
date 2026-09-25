import { useEffect, useRef, useState } from 'react';
import './App.css';
import { ApiError, baixarArquivo, cloneSite, type CloneProgress } from './api';
import { montarHtmlAutonomo, montarPreview, type Preview } from './preview';
import type { CloneResult, LinkRule } from './types';

type Status = 'parado' | 'clonando' | 'pronto' | 'erro';
type Dispositivo = 'desktop' | 'mobile';

const TEXTO_ESTAGIO: Record<CloneProgress['stage'], string> = {
  fetching: 'Rastreando o alvo…',
  rendering: 'Revelando a página escondida…',
  downloading: 'Recolhendo os arquivos…',
  packaging: 'Selando o clone…',
};

function descreveProgresso(progresso: CloneProgress | null): string {
  if (!progresso) return 'Preparando a missão…';
  if (progresso.stage === 'downloading' && progresso.total) {
    return `Recolhendo os arquivos… ${progresso.done ?? 0}/${progresso.total}`;
  }
  return TEXTO_ESTAGIO[progresso.stage];
}

/**
 * Porcentagem da barra (enche da esquerda). O download é a parte medível; as outras etapas
 * ganham marcos fixos para a barra andar para frente. null = indeterminada (fila).
 */
function porcentagem(progresso: CloneProgress | null): number | null {
  if (!progresso) return null;
  switch (progresso.stage) {
    case 'fetching':
      return 8;
    case 'rendering':
      return 18;
    case 'downloading':
      return progresso.total
        ? 20 + Math.round(((progresso.done ?? 0) / progresso.total) * 70)
        : 20;
    case 'packaging':
      return 96;
  }
}

export default function App() {
  const [url, setUrl] = useState('http://localhost:4173/ssr.html');
  const [links, setLinks] = useState<LinkRule[]>([{ from: '', to: '' }]);
  const [termos, setTermos] = useState(false);
  const [status, setStatus] = useState<Status>('parado');
  const [resultado, setResultado] = useState<CloneResult | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null);
  const [previa, setPrevia] = useState<Preview | null>(null);
  const [progresso, setProgresso] = useState<CloneProgress | null>(null);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('desktop');
  const previaAnterior = useRef<Preview | null>(null);

  // Os endereços temporários da prévia precisam ser liberados quando trocam ou ao sair.
  useEffect(() => {
    previaAnterior.current?.descartar();
    previaAnterior.current = previa;
    return () => previa?.descartar();
  }, [previa]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setStatus('clonando');
    setErro(null);
    setResultado(null);
    setPrevia(null);
    setProgresso(null);

    try {
      const clone = await cloneSite(
        {
          url: url.trim(),
          acceptedTerms: termos,
          links: links.filter((link) => link.from.trim() && link.to.trim()),
        },
        setProgresso,
      );
      setResultado(clone);
      setPrevia(await montarPreview(clone.blob));
      setStatus('pronto');
    } catch (problema) {
      const apiError = problema instanceof ApiError ? problema : null;
      setErro({
        mensagem: apiError?.message ?? 'Algo deu errado ao clonar.',
        detalhe: apiError?.detail,
      });
      setStatus('erro');
    }
  }

  function atualizarLink(indice: number, campo: keyof LinkRule, valor: string) {
    setLinks((atual) =>
      atual.map((link, posicao) => (posicao === indice ? { ...link, [campo]: valor } : link)),
    );
  }

  // Abre o clone inteiro numa aba nova, como um site de verdade (sem baixar).
  // Gera um HTML autossuficiente (tudo embutido) a partir do zip, para funcionar numa
  // aba de origem opaca — que não acessaria os endereços temporários da prévia.
  async function abrirEmNovaAba() {
    if (!resultado) return;
    const html = await montarHtmlAutonomo(resultado.blob);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
    // Não revoga na hora: a aba nova ainda precisa do endereço.
  }

  const clonando = status === 'clonando';
  const urlExibida = resultado?.meta.finalUrl ?? url;

  return (
    <div className="app">
      {clonando && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay-conteudo">
            <span className="overlay-logo">
              <img src="/logo.png" alt="Clonando" />
            </span>
            <div className="overlay-feedback">
              <div className="barra">
                {porcentagem(progresso) == null ? (
                  <div className="barra-fill indeterminada" />
                ) : (
                  <div className="barra-fill" style={{ width: `${porcentagem(progresso)}%` }} />
                )}
              </div>
              <span>{descreveProgresso(progresso)}</span>
            </div>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <span className="logo">
            <img src="/logo.png" alt="" width="60" height="60" />
          </span>
          <span className="brand-nome">
            CLONE <span className="brand-ninja">NINJA</span>
          </span>
        </div>
        <div className="avatar" aria-hidden="true">
          U
        </div>
      </header>

      <p className="tagline">
        Clone uma página autorizada e baixe um <strong>.zip</strong> pronto para hospedar, com o seu
        link no lugar.
      </p>

      <div className="grid">
        {/* ---------- Coluna esquerda: configuração ---------- */}
        <form className="painel" onSubmit={enviar}>
          <SecaoTitulo numero={1} titulo="Configurar clone" />

          <label className="campo">
            <span className="rotulo">Endereço da página</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://pagina-do-produtor.com/oferta"
              required
            />
          </label>

          <SecaoTitulo numero={2} titulo="Links" />

          {links.map((link, indice) => (
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
                onClick={() => setLinks((a) => a.filter((_, p) => p !== indice))}
                disabled={links.length === 1}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="botao-ghost"
            onClick={() => setLinks((a) => [...a, { from: '', to: '' }])}
          >
            + Link
          </button>

          <label className="termo">
            <input
              type="checkbox"
              checked={termos}
              onChange={(e) => setTermos(e.target.checked)}
              required
            />
            <span>Declaro que tenho autorização para clonar esta página.</span>
          </label>

          <button type="submit" className="cta" disabled={clonando || !termos}>
            {clonando ? 'CLONANDO…' : 'CLONAR PÁGINA'}
          </button>

          {erro && (
            <div className="erro" role="alert">
              <strong>{erro.mensagem}</strong>
              {erro.detalhe && <p className="detalhe">{erro.detalhe}</p>}
            </div>
          )}
        </form>

        {/* ---------- Coluna direita: prévia ---------- */}
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

            {resultado ? (
              <div className="preview-acoes">
                <button type="button" className="botao-preview ghost" onClick={abrirEmNovaAba}>
                  <IconeOlho /> Preview
                </button>
                <button
                  type="button"
                  className="botao-preview pronto"
                  onClick={() => baixarArquivo(resultado.blob, resultado.fileName)}
                >
                  <IconeDownload /> Baixar .zip
                </button>
              </div>
            ) : (
              <span className="botao-preview desativado">
                <IconeOlho /> Ver preview
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
              ) : (
                <PlaceholderPreview clonando={clonando} />
              )}
            </div>
          </div>

          {resultado && <Resultado clone={resultado} />}
        </div>
      </div>
    </div>
  );
}

function SecaoTitulo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="secao-titulo">
      <span className="badge">{numero}</span>
      <span>{titulo}</span>
    </div>
  );
}

function PlaceholderPreview({ clonando }: { clonando: boolean }) {
  return (
    <div className="placeholder">
      <div className="sk sk-l" />
      <div className="sk sk-m" />
      <div className="sk sk-s" />
      <div className="sk-img">{clonando ? 'gerando prévia…' : 'conteúdo original da página'}</div>
      <div className="sk-botao" />
    </div>
  );
}

function Resultado({ clone }: { clone: CloneResult }) {
  const { meta } = clone;

  return (
    <div className="resultado">
      <ul className="numeros">
        <li>
          <strong>{meta.assets}</strong> {meta.assets === 1 ? 'arquivo' : 'arquivos'}
        </li>
        <li>
          <strong>{formatarTamanho(meta.totalBytes)}</strong>
        </li>
        <li>
          <strong>{meta.linksReplaced}</strong>{' '}
          {meta.linksReplaced === 1 ? 'link trocado' : 'links trocados'}
        </li>
        <li>
          <strong>{meta.mode === 'fetch' ? 'sem navegador' : 'com navegador'}</strong>
        </li>
      </ul>

      {meta.mode === 'render' && (
        <p className="aviso">
          Página com JavaScript: aberta num navegador e capturada já montada.
          {meta.scriptsRemoved > 0 &&
            ` ${meta.scriptsRemoved} ${meta.scriptsRemoved === 1 ? 'script removido' : 'scripts removidos'} para não montar de novo por cima.`}
        </p>
      )}

      {meta.failedAssets.length > 0 && (
        <details>
          <summary>
            {meta.failedAssets.length === 1
              ? '1 arquivo falhou'
              : `${meta.failedAssets.length} arquivos falharam`}
          </summary>
          <ul className="lista-simples">
            {meta.failedAssets.map((falha) => (
              <li key={falha.url}>
                <code>{falha.url}</code> — {falha.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {meta.remainingLinks.length > 0 && (
        <details>
          <summary>
            {meta.remainingLinks.length === 1
              ? '1 link externo ficou como estava'
              : `${meta.remainingLinks.length} links externos ficaram como estavam`}
          </summary>
          <p className="ajuda">Confira se algum é botão de compra apontando para o produtor.</p>
          <ul className="lista-simples">
            {meta.remainingLinks.map((link) => (
              <li key={link}>
                <code>{link}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- Ícones (inline, sem dependência) ---------- */

function IconeDesktop() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

function IconeCelular() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function IconeOlho() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconeDownload() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
    </svg>
  );
}
