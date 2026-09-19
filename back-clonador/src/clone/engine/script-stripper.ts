import { CheerioDoc, resolveAssetUrl } from './html-rewriter';
import { isTrackingHost, TRACKING_SNIPPET } from './tracking';

export interface StripReport {
  removed: number;
  kept: number;
}

/**
 * Tira os scripts do framework de uma página que foi renderizada pelo navegador.
 *
 * O HTML capturado já é o resultado final do JavaScript. Se o bundle do React/Vue/Next
 * continuar na página, ele roda de novo ao abrir o clone e monta tudo por cima: conteúdo
 * duplicado, tela piscando ou em branco. Então o clone sai estático.
 *
 * Ficam: dados estruturados (JSON-LD, que o Google lê) e os pixels de rastreamento,
 * que a Etapa 12 vai trocar pelos do afiliado.
 *
 * Só roda no modo 'render'. Página que já veio pronta no fetch mantém os scripts dela
 * (contadores, menus), porque o HTML é o original do servidor e não conflita.
 */
export function stripFrameworkScripts($: CheerioDoc, baseUrl: string): StripReport {
  let removed = 0;
  let kept = 0;

  $('script').each((_, element) => {
    const node = $(element);
    const type = (node.attr('type') ?? '').toLowerCase();
    const src = node.attr('src');

    const isStructuredData = type === 'application/ld+json';
    const isTrackerFile = (() => {
      const absolute = resolveAssetUrl(src, baseUrl);
      return absolute ? isTrackingHost(new URL(absolute).hostname) : false;
    })();
    const isTrackerSnippet = !src && TRACKING_SNIPPET.test(node.html() ?? '');

    if (isStructuredData || isTrackerFile || isTrackerSnippet) {
      kept += 1;
      return;
    }

    node.remove();
    removed += 1;
  });

  // Pré-carregamento de scripts que não existem mais.
  $('link[rel="modulepreload"], link[rel="preload"][as="script"]').remove();

  return { removed, kept };
}
