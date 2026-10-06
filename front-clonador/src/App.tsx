import { useEffect, useRef, useState } from 'react';
import './App.css';
import { ApiError, baixarArquivo, cloneSite, type CloneProgress } from './api';
import {
  editarTexto,
  esconder,
  exportarHtml,
  ligarEditor,
  linkDe,
  mostrar,
  type EditorHandle,
} from './editor';
import { montarHtmlAutonomo, montarPreview, reempacotarZip, type Preview } from './preview';
import type { CloneResult, LinkRule, PixelRule } from './types';

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
  const [url, setUrl] = useState('');
  const [links, setLinks] = useState<LinkRule[]>([{ from: '', to: '' }]);
  const [pixels, setPixels] = useState<PixelRule[]>([{ from: '', to: '' }]);
  const [termos, setTermos] = useState(false);
  const [status, setStatus] = useState<Status>('parado');
  const [resultado, setResultado] = useState<CloneResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Preview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<CloneProgress | null>(null);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('desktop');
  const [editando, setEditando] = useState(false);
  const [selecionado, setSelecionado] = useState<HTMLElement | null>(null);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [escondidos, setEscondidos] = useState<HTMLElement[]>([]);
  const previaAnterior = useRef<Preview | null>(null);
  const previewUrlAnterior = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  // Os endereços temporários da prévia precisam ser liberados quando trocam ou ao sair.
  useEffect(() => {
    previaAnterior.current?.descartar();
    previaAnterior.current = previa;
    return () => previa?.descartar();
  }, [previa]);

  // O endereço do "Preview em nova aba" também precisa ser liberado quando troca.
  useEffect(() => {
    if (previewUrlAnterior.current && previewUrlAnterior.current !== previewUrl) {
      URL.revokeObjectURL(previewUrlAnterior.current);
    }
    previewUrlAnterior.current = previewUrl;
  }, [previewUrl]);

  // Liga o editor no documento do iframe quando o modo edição entra; desliga ao sair ou trocar.
  useEffect(() => {
    if (!editando || !previa) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const handle = ligarEditor(doc, (el) => {
      setSelecionado(el);
      setEditandoTexto(false);
    });
    editorRef.current = handle;
    return () => {
      handle.destruir();
      editorRef.current = null;
    };
  }, [editando, previa]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setStatus('clonando');
    setErro(null);
    setResultado(null);
    setPrevia(null);
    setPreviewUrl(null);
    setProgresso(null);
    setEditando(false);
    setSelecionado(null);
    setEscondidos([]);

    try {
      const clone = await cloneSite(
        {
          url: url.trim(),
          acceptedTerms: termos,
          links: links.filter((link) => link.from.trim() && link.to.trim()),
          pixels: pixels.filter((p) => p.from.trim() && p.to.trim()),
        },
        setProgresso,
      );
      // Prepara a prévia (iframe) e a página autossuficiente (Preview em nova aba) já aqui,
      // para o botão Preview ser um link pronto — sem await no clique, que bloquearia o popup.
      const [previaObj, htmlAutonomo] = await Promise.all([
        montarPreview(clone.blob),
        montarHtmlAutonomo(clone.blob),
      ]);
      setResultado(clone);
      setPrevia(previaObj);
      setPreviewUrl(URL.createObjectURL(new Blob([htmlAutonomo], { type: 'text/html' })));
      setStatus('pronto');
    } catch (problema) {
      // Só a mensagem amigável na tela; o detalhe técnico do backend não é exibido.
      const apiError = problema instanceof ApiError ? problema : null;
      setErro(apiError?.message ?? 'Algo deu errado ao clonar. Tente de novo.');
      setStatus('erro');
    }
  }

  function atualizarLink(indice: number, campo: keyof LinkRule, valor: string) {
    setLinks((atual) =>
      atual.map((link, posicao) => (posicao === indice ? { ...link, [campo]: valor } : link)),
    );
  }

  /**
   * Leva um checkout detectado para a área de troca: preenche o campo "de" (o link original)
   * na primeira linha vazia, ou cria uma nova. O afiliado só precisa colar o link dele no "para"
   * e clonar de novo. Rola para o topo para ele ver o campo.
   */
  function usarCheckout(checkoutUrl: string) {
    setLinks((atual) => {
      if (atual.some((link) => link.from.trim() === checkoutUrl)) return atual;
      const vazia = atual.findIndex((link) => !link.from.trim() && !link.to.trim());
      if (vazia >= 0) {
        return atual.map((link, i) => (i === vazia ? { from: checkoutUrl, to: '' } : link));
      }
      return [...atual, { from: checkoutUrl, to: '' }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function atualizarPixel(indice: number, campo: keyof PixelRule, valor: string) {
    setPixels((atual) =>
      atual.map((p, posicao) => (posicao === indice ? { ...p, [campo]: valor } : p)),
    );
  }

  /** Leva um pixel detectado para a área de troca (preenche o "de"); o afiliado cola o ID dele. */
  function usarPixel(pixelId: string) {
    setPixels((atual) => {
      if (atual.some((p) => p.from.trim() === pixelId)) return atual;
      const vazia = atual.findIndex((p) => !p.from.trim() && !p.to.trim());
      if (vazia >= 0) {
        return atual.map((p, i) => (i === vazia ? { from: pixelId, to: '' } : p));
      }
      return [...atual, { from: pixelId, to: '' }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function alternarTexto() {
    if (!selecionado) return;
    const novo = !editandoTexto;
    editarTexto(selecionado, novo);
    setEditandoTexto(novo);
  }

  function aplicarLink(href: string) {
    const a = selecionado && linkDe(selecionado);
    if (a) a.setAttribute('href', href);
  }

  function aplicarImagemUrl(src: string) {
    if (selecionado instanceof HTMLImageElement && src.trim()) selecionado.src = src.trim();
  }

  function aplicarImagemArquivo(arquivo: File) {
    if (!(selecionado instanceof HTMLImageElement)) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      if (selecionado instanceof HTMLImageElement) selecionado.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  }

  function aplicarEsconder() {
    if (!selecionado) return;
    esconder(selecionado);
    setEscondidos((a) => [...a, selecionado]);
    selecionado.classList.remove('cn-sel');
    setSelecionado(null);
  }

  function desfazerEsconder() {
    setEscondidos((a) => {
      const ultimo = a[a.length - 1];
      if (ultimo) mostrar(ultimo);
      return a.slice(0, -1);
    });
  }

  async function baixarEditado() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !resultado || !previa) return;
    const html = exportarHtml(doc, previa.mapa);
    const zip = await reempacotarZip(resultado.blob, html);
    baixarArquivo(zip, resultado.fileName.replace(/\.zip$/i, '-editado.zip'));
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

          <SecaoTitulo numero={3} titulo="Pixels" />
          <p className="ajuda">
            Troque o ID de rastreamento (Meta, GA4, GTM, TikTok) pelo seu. Deixe em branco para
            manter o original. Os pixels achados aparecem no resultado com um atalho.
          </p>

          {pixels.map((pixel, indice) => (
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
                onClick={() => setPixels((a) => a.filter((_, p) => p !== indice))}
                disabled={pixels.length === 1}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="botao-ghost"
            onClick={() => setPixels((a) => [...a, { from: '', to: '' }])}
          >
            + Pixel
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
              <strong>{erro}</strong>
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
                <button
                  type="button"
                  className={`botao-preview ghost ${editando ? 'ativo' : ''}`}
                  onClick={() => setEditando((e) => !e)}
                >
                  <IconeLapis /> {editando ? 'Concluir edição' : 'Editar'}
                </button>
                {!editando && (
                  <a
                    className="botao-preview ghost"
                    href={previewUrl ?? undefined}
                    target="_blank"
                    rel="noopener"
                  >
                    <IconeOlho /> Preview
                  </a>
                )}
                <button
                  type="button"
                  className="botao-preview pronto"
                  onClick={() =>
                    editando ? void baixarEditado() : baixarArquivo(resultado.blob, resultado.fileName)
                  }
                >
                  <IconeDownload /> {editando ? 'Baixar editado' : 'Baixar .zip'}
                </button>
              </div>
            ) : (
              <span className="botao-preview desativado">
                <IconeOlho /> Ver preview
              </span>
            )}
          </div>

          {editando && (
            <PainelEditor
              selecionado={selecionado}
              editandoTexto={editandoTexto}
              escondidos={escondidos.length}
              onTexto={alternarTexto}
              onLink={aplicarLink}
              onImagemUrl={aplicarImagemUrl}
              onImagemArquivo={aplicarImagemArquivo}
              onEsconder={aplicarEsconder}
              onDesfazer={desfazerEsconder}
            />
          )}

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
                  ref={iframeRef}
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

          {resultado && (
            <Resultado clone={resultado} onUsarCheckout={usarCheckout} onUsarPixel={usarPixel} />
          )}
        </div>
      </div>
    </div>
  );
}

function PainelEditor({
  selecionado,
  editandoTexto,
  escondidos,
  onTexto,
  onLink,
  onImagemUrl,
  onImagemArquivo,
  onEsconder,
  onDesfazer,
}: {
  selecionado: HTMLElement | null;
  editandoTexto: boolean;
  escondidos: number;
  onTexto: () => void;
  onLink: (href: string) => void;
  onImagemUrl: (src: string) => void;
  onImagemArquivo: (arquivo: File) => void;
  onEsconder: () => void;
  onDesfazer: () => void;
}) {
  const [linkVal, setLinkVal] = useState('');
  const [imgVal, setImgVal] = useState('');

  useEffect(() => {
    const a = selecionado?.closest('a');
    setLinkVal(a?.getAttribute('href') ?? '');
    setImgVal('');
  }, [selecionado]);

  const ehImagem = selecionado instanceof HTMLImageElement;
  const temLink = !!selecionado?.closest('a');

  return (
    <div className="editor-barra">
      {!selecionado ? (
        <p className="ajuda editor-dica">
          Clique num elemento da página ao lado para editar: trocar texto, link ou imagem, ou
          esconder o bloco.
          {escondidos > 0 && (
            <>
              {' '}
              <button type="button" className="botao-ghost pequeno" onClick={onDesfazer}>
                Mostrar último escondido ({escondidos})
              </button>
            </>
          )}
        </p>
      ) : (
        <>
          <div className="editor-alvo">
            Selecionado: <code>{descreveElemento(selecionado)}</code>
          </div>

          <div className="editor-acoes">
            <button
              type="button"
              className={`botao-ghost pequeno ${editandoTexto ? 'ativo' : ''}`}
              onClick={onTexto}
            >
              {editandoTexto ? 'Concluir texto' : 'Editar texto'}
            </button>
            <button type="button" className="botao-ghost pequeno" onClick={onEsconder}>
              Esconder bloco
            </button>
            {escondidos > 0 && (
              <button type="button" className="botao-ghost pequeno" onClick={onDesfazer}>
                Desfazer esconder ({escondidos})
              </button>
            )}
          </div>

          {temLink && (
            <div className="editor-linha">
              <span className="rotulo">Link</span>
              <input
                value={linkVal}
                onChange={(e) => setLinkVal(e.target.value)}
                placeholder="https://seu-link-de-afiliado…"
              />
              <button type="button" className="botao-ghost pequeno" onClick={() => onLink(linkVal)}>
                Aplicar
              </button>
            </div>
          )}

          {ehImagem && (
            <div className="editor-linha">
              <span className="rotulo">Imagem</span>
              <input
                value={imgVal}
                onChange={(e) => setImgVal(e.target.value)}
                placeholder="cole uma URL de imagem…"
              />
              <button
                type="button"
                className="botao-ghost pequeno"
                onClick={() => onImagemUrl(imgVal)}
              >
                Aplicar
              </button>
              <label className="botao-ghost pequeno arquivo">
                Enviar arquivo
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && onImagemArquivo(e.target.files[0])}
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Descrição curta do elemento selecionado, para a barra do editor. */
function descreveElemento(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el instanceof HTMLImageElement) return `imagem <${tag}>`;
  const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (texto) return `<${tag}> "${texto.slice(0, 40)}${texto.length > 40 ? '…' : ''}"`;
  return `<${tag}>`;
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

function Resultado({
  clone,
  onUsarCheckout,
  onUsarPixel,
}: {
  clone: CloneResult;
  onUsarCheckout: (url: string) => void;
  onUsarPixel: (id: string) => void;
}) {
  const { meta } = clone;
  const checkouts = meta.checkouts ?? [];
  const pixels = meta.pixels ?? [];

  return (
    <div className="resultado">
      {checkouts.length > 0 && (
        <div className="checkouts">
          <div className="checkouts-titulo">
            🎯 {checkouts.length === 1 ? 'Checkout detectado' : `${checkouts.length} checkouts detectados`}
          </div>
          <p className="ajuda">
            Clique em <strong>Trocar</strong> para levar o link para o campo de troca e colar o seu
            link de afiliado — depois é só clonar de novo.
          </p>
          <ul className="lista-checkouts">
            {checkouts.map((c) => (
              <li key={`${c.where}:${c.url}`}>
                <span className={`tag-plataforma ${c.platform}`}>{c.platformName}</span>
                <code className="checkout-url">{c.url}</code>
                {c.productId && <span className="checkout-id">#{c.productId}</span>}
                <button
                  type="button"
                  className="botao-ghost pequeno"
                  onClick={() => onUsarCheckout(c.url)}
                >
                  Trocar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pixels.length > 0 && (
        <div className="checkouts">
          <div className="checkouts-titulo">
            📊 {pixels.length === 1 ? 'Pixel detectado' : `${pixels.length} pixels detectados`}
          </div>
          <p className="ajuda">
            Clique em <strong>Trocar</strong> para levar o ID para a seção Pixels e colocar o seu —
            depois é só clonar de novo.
          </p>
          <ul className="lista-checkouts">
            {pixels.map((p) => (
              <li key={`${p.platform}:${p.id}`}>
                <span className={`tag-plataforma pixel ${p.platform}`}>{p.platformName}</span>
                <code className="checkout-url">{p.id}</code>
                <button
                  type="button"
                  className="botao-ghost pequeno"
                  onClick={() => onUsarPixel(p.id)}
                >
                  Trocar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          <strong>{meta.pixelsReplaced ?? 0}</strong>{' '}
          {(meta.pixelsReplaced ?? 0) === 1 ? 'pixel trocado' : 'pixels trocados'}
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

function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
