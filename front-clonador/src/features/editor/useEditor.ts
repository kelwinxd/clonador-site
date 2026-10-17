import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { reempacotarZip, type Preview } from '@/features/preview/preview';
import { baixarArquivo } from '@/shared/utils';
import {
  editarTexto,
  esconder,
  exportarHtml,
  ligarEditor,
  linkDe,
  mostrar,
  type EditorHandle,
} from './editor';
import { injetarMarcaDaguaHtml } from './watermark';

/**
 * Lógica do editor da prévia. Encapsula o ciclo de vida (ligar/desligar no iframe), a seleção
 * de elementos e as ações (texto, link, imagem, esconder) + a exportação do zip editado.
 * A UI (PainelEditor) só recebe o que este hook devolve.
 */
export function useEditor(previa: Preview | null, blob: Blob | null, fileName: string | undefined) {
  const { sessao } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const [editando, setEditando] = useState(false);
  const [selecionado, setSelecionado] = useState<HTMLElement | null>(null);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [escondidos, setEscondidos] = useState<HTMLElement[]>([]);

  // Liga o editor no iframe quando entra em edição; desliga ao sair/trocar.
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

  // Sem zip same-origin (deslogou) não há o que editar.
  useEffect(() => {
    if (!blob) setEditando(false);
  }, [blob]);

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
    if (!doc || !previa || !blob || !fileName) return;
    let html = exportarHtml(doc, previa.mapa);
    // Free: garante a marca d'água no export (mesmo que tenham apagado o selo no editor).
    if (sessao?.plano !== 'pro') html = injetarMarcaDaguaHtml(html);
    const zip = await reempacotarZip(blob, html);
    baixarArquivo(zip, fileName.replace(/\.zip$/i, '-editado.zip'));
  }

  return {
    iframeRef,
    editando,
    setEditando,
    selecionado,
    editandoTexto,
    escondidos,
    alternarTexto,
    aplicarLink,
    aplicarImagemUrl,
    aplicarImagemArquivo,
    aplicarEsconder,
    desfazerEsconder,
    baixarEditado,
  };
}
