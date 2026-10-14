import { useEffect, useState } from 'react';

/** Descrição curta do elemento selecionado, para a barra do editor. */
function descreveElemento(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el instanceof HTMLImageElement) return `imagem <${tag}>`;
  const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (texto) return `<${tag}> "${texto.slice(0, 40)}${texto.length > 40 ? '…' : ''}"`;
  return `<${tag}>`;
}

/** UI do editor: só exibe e dispara os callbacks; a lógica mora no useEditor. */
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
