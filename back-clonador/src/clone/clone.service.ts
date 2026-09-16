import { Injectable, Logger } from '@nestjs/common';
import { downloadAssets } from './engine/asset-downloader';
import { fetchPage } from './engine/fetcher';
import { collectAssets, parseHtml, rewriteAssets } from './engine/html-rewriter';
import { LinkRule, replaceLinks } from './engine/link-replacer';
import { PageMode } from './engine/page-source';
import { needsRender } from './engine/render-detector';
import { buildZip } from './engine/packager';

export interface CloneInput {
  url: string;
  links?: LinkRule[];
  forceRender?: boolean;
}

export interface CloneMeta {
  sourceUrl: string;
  finalUrl: string;
  mode: PageMode;
  /** O detector achou que a página precisa de navegador? (fallback chega na Etapa 4) */
  renderRecommended: boolean;
  reason: string;
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

/**
 * Orquestrador do pipeline. Cada passo mora em engine/ e é testado sozinho:
 * buscar -> parsear -> listar assets -> baixar -> reescrever -> trocar links -> empacotar.
 */
@Injectable()
export class CloneService {
  private readonly logger = new Logger(CloneService.name);

  async clone(input: CloneInput): Promise<CloneResult> {
    const startedAt = Date.now();

    // 1. HTTP simples primeiro. O navegador (Playwright) é plano B e entra na Etapa 4.
    const source = await fetchPage(input.url);
    this.logger.log(`fetch ok: ${source.finalUrl}`);

    // 2. Parse e checagem: a página veio pronta ou está vazia esperando o JS?
    const $ = parseHtml(source.html);
    const decision = input.forceRender
      ? { render: true, reason: 'renderização forçada pelo usuário' }
      : needsRender($);
    this.logger.log(`detector: ${decision.render ? 'precisa renderizar' : 'ok'} — ${decision.reason}`);
    // O fallback com Playwright entra na Etapa 4; por enquanto a decisão só é registrada.

    const assetUrls = collectAssets($, source.finalUrl);
    this.logger.log(`${assetUrls.length} assets encontrados`);

    // 3. Download em paralelo (p-limit).
    const download = await downloadAssets(assetUrls, { referer: source.finalUrl });

    // 4. Aponta o HTML para os arquivos locais.
    rewriteAssets($, source.finalUrl, download.map);

    // 5. Troca os links de compra pelo link do afiliado.
    const links = replaceLinks($, input.links ?? []);

    const meta: CloneMeta = {
      sourceUrl: input.url,
      finalUrl: source.finalUrl,
      mode: source.mode,
      renderRecommended: decision.render,
      reason: decision.reason,
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
      `clone concluído em ${Date.now() - startedAt}ms — ${download.assets.length} assets, ${download.failed.length} falhas`,
    );

    return { zip, meta, fileName: buildFileName(source.finalUrl) };
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
