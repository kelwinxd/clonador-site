import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { downloadPageAssets } from './engine/asset-pipeline';
import { CloneError } from './engine/errors';
import { fetchPage } from './engine/fetcher';
import { CheerioDoc, collectAssets, parseHtml, rewriteAssets } from './engine/html-rewriter';
import { LinkRule, replaceLinks } from './engine/link-replacer';
import { PageMode, PageSource } from './engine/page-source';
import { buildZip } from './engine/packager';
import { needsRender } from './engine/render-detector';
import { renderPage } from './engine/renderer';
import { stripFrameworkScripts } from './engine/script-stripper';

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

/** Respostas de "não quero robô" que costumam passar num navegador de verdade. */
const RETRY_WITH_BROWSER_STATUS = new Set([401, 403, 429, 503]);

interface ObtainedPage {
  source: PageSource;
  $: CheerioDoc;
  renderRecommended: boolean;
  reason: string;
}

/**
 * Orquestrador do pipeline. Cada passo mora em engine/ e é testado sozinho:
 * buscar (fetch, com navegador como plano B) -> parsear -> listar assets -> baixar
 * -> reescrever -> trocar links -> empacotar.
 */
@Injectable()
export class CloneService {
  private readonly logger = new Logger(CloneService.name);

  constructor(private readonly browser: BrowserService) {}

  async clone(input: CloneInput): Promise<CloneResult> {
    const startedAt = Date.now();

    // 1. Pega o HTML: fetch primeiro, navegador só se precisar.
    const { source, $, renderRecommended, reason } = await this.obtainPage(input);
    this.logger.log(`${source.mode}: ${source.finalUrl} — ${reason}`);

    // 2. Página renderizada sai sem os scripts do framework (senão monta duas vezes).
    const scripts = source.mode === 'render' ? stripFrameworkScripts($, source.finalUrl) : null;

    // 3. Lista e baixa os arquivos (inclusive o que os .css carregam por dentro).
    const assetUrls = collectAssets($, source.finalUrl);
    const download = await downloadPageAssets(assetUrls, { referer: source.finalUrl });

    // 4. Aponta o HTML para os arquivos locais.
    rewriteAssets($, source.finalUrl, download.map);

    // 5. Troca os links de compra pelo link do afiliado.
    const links = replaceLinks($, input.links ?? []);

    const meta: CloneMeta = {
      sourceUrl: input.url,
      finalUrl: source.finalUrl,
      mode: source.mode,
      renderRecommended,
      reason,
      scriptsRemoved: scripts?.removed ?? 0,
      assets: download.assets.length,
      failedAssets: download.failed,
      totalBytes: download.totalBytes,
      linksReplaced: links.replaced,
      remainingLinks: links.remaining,
      clonedAt: new Date().toISOString(),
    };

    // 6. Zip com o index, os assets e um resumo do que foi feito.
    const zip = await buildZip([
      { path: 'index.html', content: $.html() },
      ...download.assets.map((asset) => ({ path: asset.path, content: asset.body })),
      { path: 'clone-info.json', content: JSON.stringify(meta, null, 2) },
    ]);

    this.logger.log(
      `clone concluído em ${Date.now() - startedAt}ms — ${source.mode}, ${download.assets.length} assets, ${download.failed.length} falhas`,
    );

    return { zip, meta, fileName: buildFileName(source.finalUrl) };
  }

  /**
   * A estratégia híbrida inteira mora aqui:
   * 1. forçado pelo usuário -> navegador direto;
   * 2. fetch recusado com cara de anti-robô (403, 429...) -> tenta no navegador;
   * 3. fetch ok mas HTML vazio (detector) -> navegador;
   * 4. fetch ok e HTML pronto -> segue sem navegador.
   */
  private async obtainPage(input: CloneInput): Promise<ObtainedPage> {
    if (input.forceRender) {
      return this.rendered(input.url, 'renderização forçada pelo usuário');
    }

    let fetched: PageSource;
    try {
      fetched = await fetchPage(input.url);
    } catch (error) {
      if (
        error instanceof CloneError &&
        error.httpStatus !== undefined &&
        RETRY_WITH_BROWSER_STATUS.has(error.httpStatus)
      ) {
        return this.rendered(input.url, `fetch recusado (${error.httpStatus}), aberto no navegador`);
      }
      throw error;
    }

    const $ = parseHtml(fetched.html);
    const decision = needsRender($);

    if (!decision.render) {
      return { source: fetched, $, renderRecommended: false, reason: decision.reason };
    }

    return this.rendered(fetched.finalUrl, `${decision.reason}, aberto no navegador`);
  }

  private async rendered(url: string, reason: string): Promise<ObtainedPage> {
    const source = await this.browser.withContext((context) => renderPage(context, url));
    return { source, $: parseHtml(source.html), renderRecommended: true, reason };
  }
}

function buildFileName(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-');
    } catch {
      return 'clone';
    }
  })();
  const stamp = new Date().toISOString().slice(0, 10);
  return `${host}-${stamp}.zip`;
}
