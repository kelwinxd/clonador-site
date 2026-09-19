import { DownloadedAsset, DownloadOptions, downloadAssets, DownloadReport } from './asset-downloader';
import { collectCssRefs, isCssAsset, rewriteCss } from './css-assets';

/** Quantas vezes seguir @import em cadeia (css importa css importa css...). */
const MAX_CSS_DEPTH = 5;

/**
 * Baixa os assets da página e também o que os arquivos .css carregam por dentro
 * (`url()`, `@import`, fontes), seguindo os `@import` em cadeia.
 *
 * No fim, cada .css é reescrito para apontar para os arquivos locais. Como o css e os
 * assets moram juntos em assets/, a referência dentro do css vira só o nome do arquivo
 * (ex.: `url(ab12cd34.woff2)`), que é irmão do css no zip.
 */
export async function downloadPageAssets(
  htmlAssetUrls: string[],
  options: DownloadOptions = {},
): Promise<DownloadReport> {
  const report = await downloadAssets(htmlAssetUrls, options);

  let pending = cssAssets(report);
  const processedCss = new Set(pending.map((asset) => asset.url));

  for (let depth = 0; depth < MAX_CSS_DEPTH && pending.length > 0; depth++) {
    const novos = new Set<string>();
    for (const css of pending) {
      const text = css.body.toString('utf-8');
      for (const ref of collectCssRefs(text, css.url)) {
        if (!report.map.has(ref)) novos.add(ref);
      }
    }

    if (novos.size === 0) break;

    const mais = await downloadAssets([...novos], options);
    mergeReports(report, mais);

    // CSS recém-baixado (via @import) entra na próxima volta.
    pending = cssAssets(mais).filter((asset) => !processedCss.has(asset.url));
    pending.forEach((asset) => processedCss.add(asset.url));
  }

  rewriteCssBodies(report);
  return report;
}

function cssAssets(report: DownloadReport): DownloadedAsset[] {
  return report.assets.filter((asset) => isCssAsset(asset.contentType, asset.path));
}

function mergeReports(alvo: DownloadReport, extra: DownloadReport): void {
  alvo.assets.push(...extra.assets);
  alvo.failed.push(...extra.failed);
  alvo.totalBytes += extra.totalBytes;
  for (const [url, path] of extra.map) alvo.map.set(url, path);
}

/** Reescreve o conteúdo de cada .css para os nomes de arquivo locais (irmãos no zip). */
function rewriteCssBodies(report: DownloadReport): void {
  for (const css of cssAssets(report)) {
    const text = css.body.toString('utf-8');
    const novo = rewriteCss(text, css.url, (absolute) => {
      const local = report.map.get(absolute);
      return local ? basename(local) : null; // assets/ab12.png -> ab12.png (irmão do css)
    });
    css.body = Buffer.from(novo, 'utf-8');
  }
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}
