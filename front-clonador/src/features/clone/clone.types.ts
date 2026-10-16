/** Tipos da feature de clonagem. Espelham os contratos do backend. */

export interface LinkRule {
  from: string;
  to: string;
}

export interface PixelRule {
  from: string;
  to: string;
}

export type CheckoutPlatform = 'hotmart' | 'kiwify' | 'braip' | 'eduzz' | 'monetizze';

export interface CheckoutMatch {
  platform: CheckoutPlatform;
  platformName: string;
  url: string;
  productId?: string;
  where: 'link' | 'form';
}

export type PixelPlatform = 'meta' | 'ga4' | 'gtm' | 'tiktok' | 'ua';

export interface PixelMatch {
  platform: PixelPlatform;
  platformName: string;
  id: string;
}

/** Resumo do clone (vem no resultado do job). */
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

/** Estágios reportados pelo backend durante o clone. */
export type CloneStage = 'fetching' | 'rendering' | 'downloading' | 'packaging';

export interface CloneProgress {
  stage: CloneStage;
  done?: number;
  total?: number;
}

/** Parâmetros enviados ao enfileirar um clone. */
export interface CloneParams {
  url: string;
  links: LinkRule[];
  pixels: PixelRule[];
  acceptedTerms: boolean;
  forceRender?: boolean;
  /** Token do reCAPTCHA v3 (anti-spam); undefined quando o reCAPTCHA está desligado. */
  captchaToken?: string;
}

/** Resultado de um clone concluído (sem o zip — o download é separado). */
export interface CloneInfo {
  id: string;
  fileName: string;
  meta: CloneMeta;
}
