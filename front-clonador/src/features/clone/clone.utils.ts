import { MARCO_ESTAGIO, TEXTO_ESTAGIO } from './clone.constants';
import type { CloneProgress } from './clone.types';

/** Frase do progresso atual (com contagem de arquivos na etapa de download). */
export function descreveProgresso(progresso: CloneProgress | null): string {
  if (!progresso) return 'Preparando a missão…';
  if (progresso.stage === 'downloading' && progresso.total) {
    return `Recolhendo os arquivos… ${progresso.done ?? 0}/${progresso.total}`;
  }
  return TEXTO_ESTAGIO[progresso.stage];
}

/** Porcentagem da barra (enche da esquerda). null = indeterminada (fila). */
export function porcentagem(progresso: CloneProgress | null): number | null {
  if (!progresso) return null;
  if (progresso.stage === 'downloading') {
    return progresso.total
      ? MARCO_ESTAGIO.downloading + Math.round(((progresso.done ?? 0) / progresso.total) * 70)
      : MARCO_ESTAGIO.downloading;
  }
  return MARCO_ESTAGIO[progresso.stage];
}
