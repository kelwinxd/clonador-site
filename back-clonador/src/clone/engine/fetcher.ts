import { LIMITS } from '../../config';
import { CloneError } from './errors';
import { decodeHtml, httpGet } from './http-client';
import { PageSource } from './page-source';

/**
 * Passo 1 do pipeline: pegar o HTML com HTTP simples, sem navegador.
 * Custa quase nada e resolve a maioria das páginas de venda.
 */
export async function fetchPage(url: string): Promise<PageSource> {
  const result = await httpGet(url, {
    timeoutMs: LIMITS.pageTimeoutMs,
    maxBytes: LIMITS.maxHtmlBytes,
  });

  if (result.contentType && !/text\/html|application\/xhtml|text\/plain/i.test(result.contentType)) {
    throw new CloneError(
      'BLOCKED_CONTENT',
      `A URL não devolveu uma página HTML (${result.contentType})`,
    );
  }

  return {
    html: decodeHtml(result.body, result.contentType),
    finalUrl: result.finalUrl,
    mode: 'fetch',
  };
}
