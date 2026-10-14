import { useEffect, useState } from 'react';
import type { CloneProgress } from './api';
import type { CloneMeta } from './types';

/* ---------- Helpers de progresso ---------- */

const TEXTO_ESTAGIO: Record<CloneProgress['stage'], string> = {
  fetching: 'Rastreando o alvo…',
  rendering: 'Revelando a página escondida…',
  downloading: 'Recolhendo os arquivos…',
  packaging: 'Selando o clone…',
};

export function descreveProgresso(progresso: CloneProgress | null): string {
  if (!progresso) return 'Preparando a missão…';
  if (progresso.stage === 'downloading' && progresso.total) {
    return `Recolhendo os arquivos… ${progresso.done ?? 0}/${progresso.total}`;
  }
  return TEXTO_ESTAGIO[progresso.stage];
}

export function porcentagem(progresso: CloneProgress | null): number | null {
  if (!progresso) return null;
  switch (progresso.stage) {
    case 'fetching':
      return 8;
    case 'rendering':
      return 18;
    case 'downloading':
      return progresso.total ? 20 + Math.round(((progresso.done ?? 0) / progresso.total) * 70) : 20;
    case 'packaging':
      return 96;
  }
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- Pequenos componentes ---------- */

export function SecaoTitulo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="secao-titulo">
      <span className="badge">{numero}</span>
      <span>{titulo}</span>
    </div>
  );
}

export function PlaceholderPreview({ clonando }: { clonando: boolean }) {
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

/* ---------- Detecção em destaque (primeira dobra da página de resultado) ---------- */

export function DeteccaoDestaque({
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
    return (
      <div className="deteccao vazia">
        Nenhum checkout ou pixel conhecido encontrado nesta página.
      </div>
    );
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
        "Trocar" leva o link/ID para o formulário — cole o seu e clone de novo.
      </p>
    </div>
  );
}

/* ---------- Resumo numérico + detalhes ---------- */

export function ResumoClone({ meta }: { meta: CloneMeta }) {
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

/* ---------- Editor ---------- */

export function descreveElemento(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el instanceof HTMLImageElement) return `imagem <${tag}>`;
  const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (texto) return `<${tag}> "${texto.slice(0, 40)}${texto.length > 40 ? '…' : ''}"`;
  return `<${tag}>`;
}

export function PainelEditor({
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
          Clique num elemento da prévia para editar: trocar texto, link ou imagem, ou esconder o
          bloco.
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
              <button type="button" className="botao-ghost pequeno" onClick={() => onImagemUrl(imgVal)}>
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

/* ---------- Ícones ---------- */

export function IconeDesktop() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

export function IconeCelular() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function IconeOlho() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconeDownload() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
    </svg>
  );
}

export function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconeCadeado() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ marginLeft: 4, opacity: 0.8 }}
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
