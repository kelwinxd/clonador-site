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
