/**
 * Editor simples do clone (Etapa 13): trocar texto, link e imagem, e esconder bloco. Sem arrastar.
 *
 * Funciona por cima do iframe da prévia. Como o iframe é da mesma origem (srcDoc + allow-same-origin)
 * e NÃO tem allow-scripts, a página clonada não roda JavaScript — então é o React, de fora, que
 * escuta os cliques e mexe no DOM do iframe. Mais seguro (o clone não executa nada) e mais simples
 * (um único dono das edições). Ao baixar, o HTML é relido do iframe e os caminhos blob: dos assets
 * voltam a ser assets/<hash> para caber no zip.
 */

const ESTILO = `
  .cn-hover { outline: 2px dashed #f97316 !important; outline-offset: 1px; cursor: pointer !important; }
  .cn-sel   { outline: 2px solid #f97316 !important; outline-offset: 1px; }
  [contenteditable="true"] { cursor: text !important; }
`;

export interface EditorHandle {
  destruir(): void;
}

/** Liga o modo edição no documento do iframe. `onSelect` recebe o elemento clicado (ou null). */
export function ligarEditor(doc: Document, onSelect: (el: HTMLElement | null) => void): EditorHandle {
  const estilo = doc.createElement('style');
  estilo.setAttribute('data-cn-editor', '');
  estilo.textContent = ESTILO;
  doc.head.appendChild(estilo);

  let hover: HTMLElement | null = null;
  let sel: HTMLElement | null = null;

  const ehRaiz = (el: Element | null) => !el || el === doc.body || el === doc.documentElement;

  const aoMover = (e: Event) => {
    const alvo = e.target as HTMLElement | null;
    if (alvo === hover) return;
    hover?.classList.remove('cn-hover');
    hover = ehRaiz(alvo) ? null : alvo;
    hover?.classList.add('cn-hover');
  };

  const aoClicar = (e: MouseEvent) => {
    // Sem isto, clicar num <a> ou botão tentaria navegar/enviar.
    e.preventDefault();
    e.stopPropagation();
    const alvo = e.target as HTMLElement | null;
    if (!alvo || ehRaiz(alvo)) return;
    if (sel && sel !== alvo) sel.classList.remove('cn-sel');
    sel = alvo;
    sel.classList.add('cn-sel');
    onSelect(sel);
  };

  doc.addEventListener('mousemove', aoMover, true);
  doc.addEventListener('click', aoClicar, true);

  return {
    destruir() {
      doc.removeEventListener('mousemove', aoMover, true);
      doc.removeEventListener('click', aoClicar, true);
      hover?.classList.remove('cn-hover');
      sel?.classList.remove('cn-sel');
      doc.querySelectorAll('[data-cn-editor]').forEach((n) => n.remove());
      doc
        .querySelectorAll('[contenteditable="true"]')
        .forEach((n) => n.removeAttribute('contenteditable'));
      onSelect(null);
    },
  };
}

/** Liga/desliga a edição de texto inline no elemento (contentEditable). */
export function editarTexto(el: HTMLElement, ligar: boolean): void {
  if (ligar) {
    el.setAttribute('contenteditable', 'true');
    el.focus();
  } else {
    el.removeAttribute('contenteditable');
  }
}

/** Acha o <a> do elemento (ele mesmo ou um ancestral). */
export function linkDe(el: HTMLElement): HTMLAnchorElement | null {
  return el.closest('a');
}

/** Esconde o bloco. Guarda o display anterior para dar para desfazer. */
export function esconder(el: HTMLElement): void {
  el.dataset.cnDisplay = el.style.display;
  el.dataset.cnHidden = '1';
  el.style.display = 'none';
}

export function mostrar(el: HTMLElement): void {
  el.style.display = el.dataset.cnDisplay ?? '';
  delete el.dataset.cnDisplay;
  delete el.dataset.cnHidden;
}

/**
 * Lê o HTML editado do iframe, limpa os artefatos do editor e restaura os caminhos dos assets
 * (blob: -> assets/<hash>), para o zip voltar a referenciar os arquivos internos.
 */
export function exportarHtml(doc: Document, mapaCaminhoParaBlob: Map<string, string>): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('.cn-hover, .cn-sel').forEach((n) => {
    n.classList.remove('cn-hover');
    n.classList.remove('cn-sel');
    if (!n.getAttribute('class')) n.removeAttribute('class');
  });
  clone.querySelectorAll('[data-cn-editor]').forEach((n) => n.remove());
  clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  // Mantém display:none dos blocos escondidos; só tira os marcadores internos.
  clone.querySelectorAll('[data-cn-hidden]').forEach((n) => {
    n.removeAttribute('data-cn-hidden');
    (n as HTMLElement).removeAttribute('data-cn-display');
  });

  let html = `<!doctype html>${clone.outerHTML}`;
  for (const [caminho, blob] of mapaCaminhoParaBlob) {
    html = html.split(blob).join(caminho);
  }
  return html;
}
