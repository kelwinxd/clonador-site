import { isIP } from 'node:net';
import { Agent, Dispatcher, request } from 'undici';
import { LIMITS, USER_AGENT } from '../../config';
import { CloneError } from './errors';
import { assertPublicHost, parseTargetUrl } from './url-guard';
import { HttpOptions, HttpResult } from './types';

/**
 * Dispatcher que força a conexão a ir para o IP já aprovado pela trava (amarração contra
 * DNS rebinding). O `lookup` do undici é trocado para devolver sempre esse IP, então o nome
 * não é resolvido de novo. O cabeçalho Host e o certificado TLS continuam usando o nome
 * original (o undici cuida disso a partir da URL).
 */
function pinnedDispatcher(ip: string): Agent {
  const family = isIP(ip) || 4;
  // O undici chama o lookup com { all: true } e espera um array; cobrimos os dois formatos.
  const lookup = (
    _hostname: string,
    options: { all?: boolean },
    callback: (err: NodeJS.ErrnoException | null, address: unknown, family?: number) => void,
  ) => {
    if (options && options.all) {
      callback(null, [{ address: ip, family }]);
    } else {
      callback(null, ip, family);
    }
  };
  return new Agent({
    connect: { lookup: lookup as never },
  });
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
    // Resolve e checa UMA vez; conecta nesse mesmo IP (amarração anti-rebinding).
    const approvedIp = await assertPublicHost(current);
    const dispatcher = approvedIp ? pinnedDispatcher(approvedIp) : undefined;
    const fecharDispatcher = () => dispatcher?.close().catch(() => undefined);

    let response;
    try {
      response = await requestOnce(current, timeoutMs, options, dispatcher);
    } catch (error) {
      await fecharDispatcher();
      throw error;
    }

    if (REDIRECT_STATUS.has(response.statusCode)) {
      const location = response.headers['location'];
      const target = Array.isArray(location) ? location[0] : location;
      await response.body.dump().catch(() => undefined);
      await fecharDispatcher();
      if (!target) {
        throw new CloneError('FETCH_FAILED', `Redirecionamento ${response.statusCode} sem destino`);
      }
      current = parseTargetUrl(new URL(target, current).toString());
      continue;
    }

    if (response.statusCode >= 400) {
      await response.body.dump().catch(() => undefined);
      await fecharDispatcher();
      throw new CloneError(
        'FETCH_FAILED',
        `A página respondeu ${response.statusCode}`,
        response.statusCode,
      );
    }

    try {
      const body = await readWithLimit(response.body, maxBytes, current.toString());
      const contentTypeHeader = response.headers['content-type'];
      const contentType = Array.isArray(contentTypeHeader)
        ? contentTypeHeader[0]
        : (contentTypeHeader ?? '');
      return { body, contentType, finalUrl: current.toString(), status: response.statusCode };
    } finally {
      await fecharDispatcher();
    }
  }

  throw new CloneError('FETCH_FAILED', 'Redirecionamentos demais');
}

async function requestOnce(
  url: URL,
  timeoutMs: number,
  options: HttpOptions,
  dispatcher?: Dispatcher,
) {
  try {
    return await request(url, {
      // O undici v7 não segue redirecionamento sozinho — e é o que queremos:
      // cada destino passa pela checagem de host antes do próximo pedido.
      method: 'GET',
      dispatcher, // amarra a conexão no IP aprovado (quando houver)
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
