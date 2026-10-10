/** Espelha o CloneMeta do backend (back-clonador/src/clone/clone.service.ts). */
export interface CloneMeta {
  sourceUrl: string;
  finalUrl: string;
  mode: 'fetch' | 'render';
  renderRecommended: boolean;
  reason: string;
  scriptsRemoved: number;
  assets: number;
  failedAssets: Array<{ url: string; reason: string }>;
  totalBytes: number;
  linksReplaced: number;
  remainingLinks: string[];
  checkouts: CheckoutMatch[];
  pixels: PixelMatch[];
  pixelsReplaced: number;
  clonedAt: string;
}

/** Espelha o PixelMatch do backend (engine/types.ts). */
export type PixelPlatform = 'meta' | 'ga4' | 'gtm' | 'tiktok' | 'ua';

export interface PixelMatch {
  platform: PixelPlatform;
  platformName: string;
  id: string;
}

export interface PixelRule {
  from: string;
  to: string;
}

/** Espelha o CheckoutMatch do backend (engine/types.ts). */
export type CheckoutPlatform = 'hotmart' | 'kiwify' | 'braip' | 'eduzz' | 'monetizze';

export interface CheckoutMatch {
  platform: CheckoutPlatform;
  platformName: string;
  url: string;
  productId?: string;
  where: 'link' | 'form';
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
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'SESSAO';
