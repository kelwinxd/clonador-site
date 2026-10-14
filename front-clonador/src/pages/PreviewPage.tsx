import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { baixarArquivo, urlPreview } from '../api';
import {
  editarTexto,
  esconder,
  exportarHtml,
  ligarEditor,
  linkDe,
  mostrar,
  type EditorHandle,
} from '../editor';
import { reempacotarZip } from '../preview';
import { useApp } from '../state';
import {
  DeteccaoDestaque,
  IconeCadeado,
  IconeCelular,
  IconeDesktop,
  IconeDownload,
  IconeLapis,
  IconeOlho,
  PainelEditor,
  PlaceholderPreview,
  ResumoClone,
  descreveProgresso,
  porcentagem,
} from '../ui';

type Dispositivo = 'desktop' | 'mobile';

export default function PreviewPage() {
  const app = useApp();
  const navigate = useNavigate();

  const [dispositivo, setDispositivo] = useState<Dispositivo>('desktop');
  const [editando, setEditando] = useState(false);
  const [selecionado, setSelecionado] = useState<HTMLElement | null>(null);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [escondidos, setEscondidos] = useState<HTMLElement[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  const { sessao, resultado, blob, previa, previewUrl, previewSrc, status, progresso, erro } = app;
  const logado = !!sessao;

  // Liga o editor no iframe quando entra em edição.
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

  // Sai do modo edição ao deslogar (sem zip same-origin não há o que editar).
  useEffect(() => {
    if (!logado) setEditando(false);
  }, [logado]);

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
    if (!doc || !resultado || !previa || !blob) return;
    const html = exportarHtml(doc, previa.mapa);
    const zip = await reempacotarZip(blob, html);
    baixarArquivo(zip, resultado.fileName.replace(/\.zip$/i, '-editado.zip'));
  }

  function aoClicarBaixar() {
    if (!resultado) return;
    if (!sessao) return navigate('/criar-conta');
    if (editando) return void baixarEditado();
    if (blob) baixarArquivo(blob, resultado.fileName);
  }
  function aoClicarEditar() {
    if (!sessao) return navigate('/criar-conta');
    setEditando((e) => !e);
  }

  function trocarCheckout(url: string) {
    app.usarCheckout(url);
    navigate('/');
  }
  function trocarPixel(id: string) {
    app.usarPixel(id);
    navigate('/');
  }

  // Sem clone em andamento nem pronto: veio direto na URL.
  if (status === 'parado' && !resultado) {
    return (
      <div className="painel aviso-vazio">
        <p>Nenhum clone ainda. Comece pelo formulário.</p>
        <button type="button" className="cta pequeno" onClick={() => navigate('/')}>
          Ir para o formulário
        </button>
      </div>
    );
  }

  const clonando = status === 'clonando';
  const urlExibida = resultado?.meta.finalUrl ?? app.url;

  return (
    <div className="resultado-pagina">
      <div className="resultado-topo">
        <button type="button" className="botao-ghost pequeno" onClick={() => navigate('/')}>
          ← Novo clone
        </button>
        {resultado && <span className="resultado-url">{urlExibida}</span>}
      </div>

      {/* Detecção em destaque, na primeira dobra */}
      {resultado && (
        <DeteccaoDestaque
          meta={resultado.meta}
          onUsarCheckout={trocarCheckout}
          onUsarPixel={trocarPixel}
        />
      )}

      {erro && status === 'erro' && (
        <div className="erro" role="alert">
          <strong>{erro}</strong>
        </div>
      )}

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

          {resultado && status === 'pronto' ? (
            <div className="preview-acoes">
              <button
                type="button"
                className={`botao-preview ghost ${editando ? 'ativo' : ''}`}
                onClick={aoClicarEditar}
              >
                <IconeLapis /> {editando ? 'Concluir edição' : 'Editar'}
                {!logado && <IconeCadeado />}
              </button>
              {!editando && (
                <a
                  className="botao-preview ghost"
                  href={logado ? (previewUrl ?? undefined) : urlPreview(resultado.id)}
                  target="_blank"
                  rel="noopener"
                >
                  <IconeOlho /> Preview
                </a>
              )}
              <button type="button" className="botao-preview pronto" onClick={aoClicarBaixar}>
                <IconeDownload /> {editando ? 'Baixar editado' : 'Baixar .zip'}
                {!logado && <IconeCadeado />}
              </button>
            </div>
          ) : (
            <span className="botao-preview desativado">
              <IconeOlho /> {clonando ? 'Gerando…' : 'Prévia'}
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
            {clonando && (
              <div className="viewport-progresso">
                <div className="barra">
                  {porcentagem(progresso) == null ? (
                    <div className="barra-fill indeterminada" />
                  ) : (
                    <div className="barra-fill" style={{ width: `${porcentagem(progresso)}%` }} />
                  )}
                </div>
                <span>{descreveProgresso(progresso)}</span>
              </div>
            )}
            {!clonando && previa ? (
              <iframe
                ref={iframeRef}
                className="previa-frame"
                title="Prévia do clone"
                sandbox="allow-same-origin"
                srcDoc={previa.html}
              />
            ) : !clonando && previewSrc ? (
              <iframe
                className="previa-frame"
                title="Prévia do clone"
                sandbox="allow-same-origin"
                src={previewSrc}
              />
            ) : (
              !clonando && <PlaceholderPreview clonando={false} />
            )}
          </div>
        </div>

        {resultado && status === 'pronto' && !logado && (
          <div className="cta-conta">
            <strong>Gostou?</strong> Crie uma conta para <strong>baixar</strong> o .zip pronto para
            hospedar e <strong>editar</strong> o clone.
            <button type="button" className="cta pequeno" onClick={() => navigate('/criar-conta')}>
              Criar conta
            </button>
          </div>
        )}

        {resultado && status === 'pronto' && <ResumoClone meta={resultado.meta} />}
      </div>
    </div>
  );
}
