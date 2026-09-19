import { LinkRule } from './engine/link-replacer';

/** O que entra na fila quando alguém pede um clone. */
export interface CloneJobData {
  url: string;
  links?: LinkRule[];
  forceRender?: boolean;
}

/** Etapas do clone, na ordem em que acontecem. */
export type CloneStage = 'fetching' | 'rendering' | 'downloading' | 'packaging';

/**
 * Progresso de um job. Vira o payload do job.updateProgress e, na Etapa 7, o evento do
 * WebSocket. Guardado no Redis, então é pequeno e serializável.
 */
export interface CloneProgress {
  stage: CloneStage;
  /** Preenchidos na etapa de download dos assets. */
  done?: number;
  total?: number;
}

export type ProgressReporter = (progress: CloneProgress) => void;
