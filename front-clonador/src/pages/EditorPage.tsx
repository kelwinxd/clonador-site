import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useClone } from '@/features/clone/CloneContext';
import { PainelEditor } from '@/features/editor/PainelEditor';
import { useEditor } from '@/features/editor/useEditor';
import { ROTAS } from '@/shared/constants';
import { IconeDownload } from '@/shared/ui/icons';

/**
 * Editor em tela cheia (estilo Elementor): mais espaço para mexer no clone. Edição só para quem
 * tem conta (o zip same-origin). Sem clone/sem login, manda de volta para o lugar certo.
 */
export default function EditorPage() {
  const { resultado, previa, blob } = useClone();
  const { sessao } = useAuth();
  const navigate = useNavigate();

  const editor = useEditor(previa, blob, resultado?.fileName);

  // Entra em modo edição assim que a prévia same-origin estiver pronta.
  useEffect(() => {
    if (previa && blob) editor.setEditando(true);
  }, [previa, blob]);

  if (!resultado) {
    return (
      <div className="painel aviso-vazio">
        <p>Nenhum clone para editar.</p>
        <button type="button" className="cta pequeno" onClick={() => navigate(ROTAS.clonar)}>
          Ir para o formulário
        </button>
      </div>
    );
  }
  if (!sessao) {
    return (
      <div className="painel aviso-vazio">
        <p>Crie uma conta para editar o clone.</p>
        <button type="button" className="cta pequeno" onClick={() => navigate(ROTAS.criarConta)}>
          Criar conta
        </button>
      </div>
    );
  }
  return (
    <div className="editor-pagina">
      <div className="editor-topo">
        <button type="button" className="botao-ghost pequeno" onClick={() => navigate(ROTAS.resultado)}>
          ← Voltar
        </button>
        <span className="editor-titulo">Editando: {resultado.fileName}</span>
        <button type="button" className="botao-preview pronto" onClick={() => void editor.baixarEditado()}>
          <IconeDownload /> Salvar e baixar
        </button>
      </div>

      <PainelEditor
        selecionado={editor.selecionado}
        editandoTexto={editor.editandoTexto}
        escondidos={editor.escondidos.length}
        onTexto={editor.alternarTexto}
        onLink={editor.aplicarLink}
        onImagemUrl={editor.aplicarImagemUrl}
        onImagemArquivo={editor.aplicarImagemArquivo}
        onEsconder={editor.aplicarEsconder}
        onDesfazer={editor.desfazerEsconder}
      />

      <div className="editor-palco">
        {previa ? (
          <iframe
            ref={editor.iframeRef}
            className="editor-frame"
            title="Editor do clone"
            sandbox="allow-same-origin"
            srcDoc={previa.html}
          />
        ) : (
          <div className="editor-carregando">Preparando o editor…</div>
        )}
      </div>
    </div>
  );
}
