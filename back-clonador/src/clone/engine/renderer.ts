import type { APIResponse, BrowserContext, Page, Route } from 'playwright';
import { LIMITS } from '../../config';
import { CloneError } from './errors';
import { PageSource } from './page-source';
import { isTrackingHost } from './tracking';
import { assertPublicHost, parseTargetUrl } from './url-guard';

/** Diz se o navegador pode falar com esse endereço. */
export type HostChecker = (url: URL) => Promise<boolean>;

export interface RenderOptions {
  /** Troca a checagem de host. Existe para os testes simularem a rede interna. */
  isAllowed?: HostChecker;
}

/**
 * Tipos que não ajudam a montar o HTML. Os arquivos em si são baixados depois,
 * pelo caminho normal (asset-downloader), então aqui só atrasariam a renderização.
 */
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

/** Erro interno para sinalizar host barrado dentro do tratador de rotas. */
class BlockedError extends Error {
  constructor(readonly host: string) {
    super(`host bloqueado: ${host}`);
  }
}

/** Checagem padrão: a mesma trava de SSRF do fetch, com cache por domínio dentro do job. */
export function publicHostChecker(): HostChecker {
  const cache = new Map<string, Promise<boolean>>();
  return (url) => {
    const key = url.host;
    let result = cache.get(key);
    if (!result) {
      result = assertPublicHost(url).then(
        () => true,
        () => false,
      );
      cache.set(key, result);
    }
    return result;
  };
}

/**
 * Plano B do pipeline: abre a página num navegador de verdade, deixa o JavaScript rodar
 * e captura o HTML final.
 *
 * Segurança (SSRF pelo navegador): não basta checar a URL inicial. O JavaScript da página
 * faz as próprias requisições, e uma delas pode redirecionar para a rede interna. Duas
 * defesas cobrem isso:
 * - a navegação principal usa route.continue() (preserva os cabeçalhos reais do navegador,
 *   o que faz sites com anti-robô responderem), e o destino final é conferido depois do goto,
 *   incluindo cada parada da cadeia de redirecionamento;
 * - requisições fetch/xhr do JavaScript são interceptadas, e os redirecionamentos delas são
 *   seguidos um a um aqui, checando cada parada — é o vetor clássico de vazamento.
 */
export async function renderPage(
  context: BrowserContext,
  rawUrl: string,
  options: RenderOptions = {},
): Promise<PageSource> {
  const target = parseTargetUrl(rawUrl);

  if (options.isAllowed) {
    if (!(await options.isAllowed(target))) {
      throw new CloneError('BLOCKED_HOST', `Endereço bloqueado: ${target.host}`);
    }
  } else {
    await assertPublicHost(target); // erro com a mensagem detalhada
  }

  const isAllowed = options.isAllowed ?? publicHostChecker();
  const page = await context.newPage();
  const state = { blockedHost: null as string | null };

  await page.route('**/*', (route) => guardRoute(route, page, isAllowed, state));

  try {
    const response = await page.goto(target.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: LIMITS.renderTimeoutMs,
    });

    if (response && response.status() >= 400) {
      throw new CloneError(
        'FETCH_FAILED',
        `A página respondeu ${response.status()} também no navegador`,
        response.status(),
      );
    }

    // Confere a URL final e cada parada do redirecionamento da navegação principal.
    await assertNavigationAllowed(page, response, isAllowed);

    await waitForQuiet(page);
    await scrollToBottom(page);
    await waitForQuiet(page);

    return { html: await page.content(), finalUrl: page.url(), mode: 'render' };
  } catch (error) {
    if (state.blockedHost) {
      throw new CloneError(
        'BLOCKED_HOST',
        `A página redirecionou para a rede interna: ${state.blockedHost}`,
      );
    }
    if (error instanceof CloneError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    if (/timeout/i.test(message)) {
      throw new CloneError('TIMEOUT', `O navegador esperou demais por ${target.hostname}`);
    }
    throw new CloneError(
      'RENDER_FAILED',
      `Falha ao renderizar ${target.hostname}: ${message.split('\n')[0]}`,
    );
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function assertNavigationAllowed(
  page: Page,
  response: Awaited<ReturnType<Page['goto']>>,
  isAllowed: HostChecker,
): Promise<void> {
  const finalUrl = safeUrl(page.url());
  if (finalUrl && !(await isAllowed(finalUrl))) {
    throw new CloneError('BLOCKED_HOST', `A página terminou na rede interna: ${finalUrl.host}`);
  }

  // redirectedFrom() encadeia as requisições anteriores da navegação.
  let request = response?.request().redirectedFrom() ?? null;
  while (request) {
    const url = safeUrl(request.url());
    if (url && !(await isAllowed(url))) {
      throw new CloneError('BLOCKED_HOST', `Redirecionamento pela rede interna: ${url.host}`);
    }
    request = request.redirectedFrom();
  }
}

async function guardRoute(
  route: Route,
  page: Page,
  isAllowed: HostChecker,
  state: { blockedHost: string | null },
): Promise<void> {
  try {
    const request = route.request();
    const url = safeUrl(request.url());

    // data:, blob: e afins não saem da máquina.
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      await route.continue();
      return;
    }

    const isMainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();

    if (isMainNavigation) {
      // Deixa o navegador de verdade cuidar (cabeçalhos, redirecionamentos). O destino é
      // conferido depois do goto, em assertNavigationAllowed.
      if (await isAllowed(url)) {
        await route.continue();
      } else {
        state.blockedHost = url.host;
        await route.abort('blockedbyclient');
      }
      return;
    }

    // Sub-recurso que não ajuda a montar o HTML.
    if (BLOCKED_RESOURCE_TYPES.has(request.resourceType()) || isTrackingHost(url.hostname)) {
      await route.abort('blockedbyclient');
      return;
    }

    if (!(await isAllowed(url))) {
      await route.abort('blockedbyclient');
      return;
    }

    // fetch/xhr do JavaScript: o vetor de vazamento. Segue os redirecionamentos aqui,
    // checando cada parada, e devolve só a resposta final ao navegador.
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      try {
        const response = await fetchFollowingRedirects(route, url, isAllowed);
        await route.fulfill({ response });
      } catch (error) {
        if (error instanceof BlockedError) {
          await route.abort('blockedbyclient');
        } else {
          await route.abort('failed');
        }
      }
      return;
    }

    // css, script: seguem pelo navegador. Um redirecionamento de css/script para a rede
    // interna é bem menos explorável (o serviço interno teria que servir css/js válido) e
    // fica fora do vetor principal; o host direto já foi checado acima.
    await route.continue();
  } catch {
    // Página fechada no meio do caminho ou requisição que falhou: nada a fazer.
    await route.abort('failed').catch(() => undefined);
  }
}

/** Segue redirecionamentos de um fetch/xhr manualmente, checando o host de cada parada. */
async function fetchFollowingRedirects(
  route: Route,
  first: URL,
  isAllowed: HostChecker,
): Promise<APIResponse> {
  let current = first;

  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    // Hop 0 usa a requisição original (método, cabeçalhos, corpo); os seguintes trocam a URL.
    const response = await route.fetch({
      ...(hop === 0 ? {} : { url: current.toString() }),
      maxRedirects: 0,
      timeout: LIMITS.renderTimeoutMs,
    });

    const status = response.status();
    const location = response.headers()['location'];
    if (status >= 300 && status < 400 && location) {
      const next = safeUrl(location, current);
      if (!next || !(await isAllowed(next))) {
        throw new BlockedError(next?.host ?? location);
      }
      current = next;
      continue;
    }

    return response;
  }

  throw new BlockedError('redirecionamentos demais');
}

function safeUrl(value: string, base?: URL): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

async function waitForQuiet(page: Page): Promise<void> {
  await page
    .waitForLoadState('networkidle', { timeout: LIMITS.renderIdleMs })
    .catch(() => undefined); // página com polling nunca fica quieta; segue com o que tem
}

/** Rola até o fim para disparar lazy load e seções que só aparecem com scroll. */
async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(
    async ({ steps, delay }) => {
      for (let step = 0; step < steps; step++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((done) => setTimeout(done, delay));
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight) break;
      }
      window.scrollTo(0, 0);
    },
    { steps: LIMITS.renderScrollSteps, delay: 150 },
  );
}
