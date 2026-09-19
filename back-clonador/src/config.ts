/**
 * Limites do motor de clonagem.
 * Ficam num lugar só para serem fáceis de ajustar quando o projeto for para o servidor.
 */
export const LIMITS = {
  /** Tempo máximo para baixar o HTML da página. */
  pageTimeoutMs: 20_000,
  /** Tempo máximo para baixar cada asset (imagem, css, fonte...). */
  assetTimeoutMs: 15_000,
  /** HTML maior que isso é recusado. */
  maxHtmlBytes: 5 * 1024 * 1024,
  /** Asset maior que isso é pulado. */
  maxAssetBytes: 10 * 1024 * 1024,
  /** Soma de todos os assets de um clone. */
  maxTotalBytes: 80 * 1024 * 1024,
  /** Quantidade máxima de assets por clone. */
  maxAssets: 300,
  /** Downloads em paralelo. */
  assetConcurrency: 8,
  /** Redirecionamentos seguidos antes de desistir. */
  maxRedirects: 5,

  /** Navegação no Playwright: tempo máximo para a página abrir. */
  renderTimeoutMs: 30_000,
  /** Espera pela rede ficar quieta. Página com polling nunca fica, então tem teto. */
  renderIdleMs: 5_000,
  /** Quantas telas rolar para disparar imagens e seções que carregam tarde. */
  renderScrollSteps: 15,
  /** Abas renderizando ao mesmo tempo no mesmo navegador. A fila da Etapa 6 limita o resto. */
  maxRenderPages: 2,
} as const;

/** User-Agent de navegador real: muitas páginas recusam clientes sem isso. */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
