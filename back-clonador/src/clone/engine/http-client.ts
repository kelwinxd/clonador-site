import { request } from 'undici';
import { LIMITS, USER_AGENT } from '../../config';
import { CloneError } from './errors';
import { assertPublicHost, parseTargetUrl } from './url-guard';

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

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/**
 * GET com as travas do projeto: verifica o host a cada redirecionamento,
 * corta em tempo limite e para de ler quando passa do tamanho máximo.
 */
export async function httpGet(rawUrl: string, options: HttpOptions = {}): Promise<HttpResult> {
  const timeoutMs = options.timeoutMs ?? LIMITS.pageTimeoutMs;
  const maxBytes = options.maxBytes ?? LIMITS.maxHtmlBytes;

  let current = parseTargetUrl(rawUrl);

  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    await assertPublicHost(current);

    const response = await requestOnce(current, timeoutMs, options);

    if (REDIRECT_STATUS.has(response.statusCode)) {
      const location = response.headers['location'];
      const target = Array.isArray(location) ? location[0] : location;
      if (!target) {
        throw new CloneError('FETCH_FAILED', `Redirecionamento ${response.statusCode} sem destino`);
      }
      await response.body.dump().catch(() => undefined);
      current = parseTargetUrl(new URL(target, current).toString());
      continue;
    }

    if (response.statusCode >= 400) {
      await response.body.dump().catch(() => undefined);
      throw new CloneError(
        'FETCH_FAILED',
        `A página respondeu ${response.statusCode}`,
        response.statusCode,
      );
    }

    const body = await readWithLimit(response.body, maxBytes, current.toString());
    const contentTypeHeader = response.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : (contentTypeHeader ?? '');

    return { body, contentType, finalUrl: current.toString(), status: response.statusCode };
  }

  throw new CloneError('FETCH_FAILED', 'Redirecionamentos demais');
}

async function requestOnce(url: URL, timeoutMs: number, options: HttpOptions) {
  try {
    return await request(url, {
      // O undici v7 não segue redirecionamento sozinho — e é o que queremos:
      // cada destino passa pela checagem de host antes do próximo pedido.
      method: 'GET',
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      headers: {
        'user-agent': USER_AGENT,
        accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
        ...(options.referer ? { referer: options.referer } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timeout|aborted/i.test(message)) {
      throw new CloneError('TIMEOUT', `Tempo esgotado em ${url.hostname}`);
    }
    throw new CloneError('FETCH_FAILED', `Falha ao acessar ${url.hostname}: ${message}`);
  }
}

async function readWithLimit(
  body: AsyncIterable<Buffer>,
  maxBytes: number,
  url: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new CloneError('TOO_LARGE', `Conteúdo acima do limite em ${url}`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Descobre o charset pelo cabeçalho ou pela tag <meta> e devolve o texto decodificado. */
export function decodeHtml(body: Buffer, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const head = body.subarray(0, 2048).toString('latin1');
  const fromMeta =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(head)?.[1];

  const charset = (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return body.toString('utf-8');
  }
}
