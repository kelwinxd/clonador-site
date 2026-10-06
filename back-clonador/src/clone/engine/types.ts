import type * as cheerio from 'cheerio';

/**
 * Tipos de dados do motor (engine) — as "formas" que cruzam os módulos do pipeline.
 * As funções, classes e constantes ficam em cada arquivo; aqui só os contratos.
 */

/** Códigos de erro do motor. O controller traduz para status HTTP e o front mostra a mensagem. */
export type CloneErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_CONTENT'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'FETCH_FAILED'
  | 'RENDER_FAILED';

/** Documento do cheerio (HTML já carregado para manipular). */
export type CheerioDoc = cheerio.CheerioAPI;

/** Como o HTML foi obtido. 'render' só entra quando a página vem vazia no fetch. */
export type PageMode = 'fetch' | 'render';

export interface PageSource {
  html: string;
  /** URL final, depois dos redirecionamentos. É a base para resolver caminhos relativos. */
  finalUrl: string;
  mode: PageMode;
  /** Por que esse modo foi escolhido — vai para o log e para a resposta da API. */
  reason?: string;
}

export interface HttpResult {
  body: Buffer;
  contentType: string;
  /** URL depois de todos os redirecionamentos: é ela que resolve os caminhos relativos. */
  finalUrl: string;
  status: number;
}

export interface HttpOptions {
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string;
  /** Mandado como Referer: alguns servidores só entregam imagem/fonte se vier da própria página. */
  referer?: string;
}

export interface DownloadedAsset {
  url: string;
  /** Caminho dentro do zip, ex.: assets/9f1c2b3d4e.png */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface DownloadReport {
  assets: DownloadedAsset[];
  /** URL absoluta -> caminho local, usado na reescrita do HTML. */
  map: Map<string, string>;
  failed: Array<{ url: string; reason: string }>;
  totalBytes: number;
}

export interface DownloadOptions {
  referer?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface LinkRule {
  /** Trecho que identifica o link original (ex.: pay.hotmart.com/XXXX). */
  from: string;
  /** Link do afiliado que entra no lugar. */
  to: string;
}

/** Plataformas de checkout que o detector reconhece. */
export type CheckoutPlatform = 'hotmart' | 'kiwify' | 'braip' | 'eduzz' | 'monetizze';

/** Um link de checkout achado na página. */
export interface CheckoutMatch {
  platform: CheckoutPlatform;
  /** Nome amigável da plataforma, para a interface. */
  platformName: string;
  /** URL do checkout, como está na página. */
  url: string;
  /** Código do produto extraído da URL, quando dá para identificar. */
  productId?: string;
  /** Onde foi achado: link (<a>) ou formulário (<form>). */
  where: 'link' | 'form';
}

/** O que o detector devolve: os checkouts achados, sem repetir URL. */
export interface CheckoutReport {
  matches: CheckoutMatch[];
  /** Plataformas distintas encontradas (atalho para a interface). */
  platforms: CheckoutPlatform[];
}

/** Plataformas de pixel/analytics que o detector reconhece. */
export type PixelPlatform = 'meta' | 'ga4' | 'gtm' | 'tiktok' | 'ua';

/** Um pixel achado na página. */
export interface PixelMatch {
  platform: PixelPlatform;
  /** Nome amigável, para a interface. */
  platformName: string;
  /** O ID encontrado (ex.: G-ABC123, GTM-XYZ, 1234567890123456). */
  id: string;
}

/** O que o detector de pixels devolve, sem repetir ID. */
export interface PixelReport {
  matches: PixelMatch[];
}

/** Regra de troca de pixel: o ID antigo sai, o do afiliado entra. */
export interface PixelRule {
  from: string;
  to: string;
}

export interface PixelReplaceReport {
  replaced: number;
}

export interface ReplaceReport {
  replaced: number;
  /** Links de saída que sobraram sem troca — a interface mostra para o afiliado conferir. */
  remaining: string[];
}

export interface RenderDecision {
  render: boolean;
  /** Motivo da decisão: vai para o log e para o clone-info.json. */
  reason: string;
}

/** Diz se o navegador pode falar com esse endereço. */
export type HostChecker = (url: URL) => Promise<boolean>;

export interface RenderOptions {
  /** Troca a checagem de host. Existe para os testes simularem a rede interna. */
  isAllowed?: HostChecker;
}

export interface StripReport {
  removed: number;
  kept: number;
}

export interface ZipEntry {
  path: string;
  content: Buffer | string;
}
