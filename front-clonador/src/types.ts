/** Espelha o CloneMeta do backend (back-clonador/src/clone/clone.service.ts). */
export interface CloneMeta {
  sourceUrl: string;
  finalUrl: string;
  mode: 'fetch' | 'render';
  renderRecommended: boolean;
  reason: string;
  assets: number;
  failedAssets: Array<{ url: string; reason: string }>;
  totalBytes: number;
  linksReplaced: number;
  remainingLinks: string[];
  clonedAt: string;
}

export interface LinkRule {
  from: string;
  to: string;
}

export interface CloneResult {
  meta: CloneMeta;
  blob: Blob;
  fileName: string;
}

/** Códigos de erro do motor. A interface traduz cada um numa frase útil. */
export type CloneErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_CONTENT'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'FETCH_FAILED'
  | 'RENDER_FAILED'
  | 'NETWORK';
