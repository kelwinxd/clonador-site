import { CloneErrorCode, LinkRule, PageMode } from './engine/types';

/**
 * Tipos de dados do módulo de clonagem e suas dependências (serviço, fila, worker,
 * armazenamento). As classes e os providers ficam em cada arquivo; aqui só os contratos.
 */

/* ---------- Serviço de clonagem ---------- */

export interface CloneInput {
  url: string;
  links?: LinkRule[];
  forceRender?: boolean;
}

export interface CloneMeta {
  sourceUrl: string;
  finalUrl: string;
  mode: PageMode;
  /** O detector (ou o usuário, ou um bloqueio no fetch) pediu navegador? */
  renderRecommended: boolean;
  reason: string;
  /** Scripts do framework tirados no modo render. */
  scriptsRemoved: number;
  assets: number;
  failedAssets: Array<{ url: string; reason: string }>;
  totalBytes: number;
  linksReplaced: number;
  remainingLinks: string[];
  clonedAt: string;
}

export interface CloneResult {
  zip: Buffer;
  meta: CloneMeta;
  fileName: string;
}

/* ---------- Fila (BullMQ) e progresso ---------- */

/** O que entra na fila quando alguém pede um clone. */
export interface CloneJobData {
  url: string;
  links?: LinkRule[];
  forceRender?: boolean;
}

/** Etapas do clone, na ordem em que acontecem. */
export type CloneStage = 'fetching' | 'rendering' | 'downloading' | 'packaging';

/**
 * Progresso de um job. Vira o payload do job.updateProgress e o evento do WebSocket.
 * Guardado no Redis, então é pequeno e serializável.
 */
export interface CloneProgress {
  stage: CloneStage;
  /** Preenchidos na etapa de download dos assets. */
  done?: number;
  total?: number;
}

export type ProgressReporter = (progress: CloneProgress) => void;

/** O que o job devolve (fica no Redis, então é pequeno — o zip vai para o disco). */
export interface CloneJobResult {
  fileName: string;
  meta: unknown;
}

/** Erro serializado no failedReason do job, para o status devolver o código certo. */
export interface SerializedError {
  code: CloneErrorCode | 'UNKNOWN';
  message: string;
  httpStatus?: number;
}

/* ---------- Armazenamento do resultado (disco) ---------- */

export interface StoredResult {
  fileName: string;
  meta: CloneMeta;
}
