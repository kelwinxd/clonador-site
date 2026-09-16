import { CheerioDoc } from './html-rewriter';

export interface RenderDecision {
  render: boolean;
  /** Motivo da decisão: vai para o log e para o clone-info.json. */
  reason: string;
}

/** Ajustes da heurística num lugar só, para calibrar com páginas reais. */
export const DETECTOR = {
  /** Abaixo disso o HTML é considerado vazio. */
  minTextLength: 400,
  /** Texto dentro do container do SPA que ainda conta como vazio. */
  maxRootText: 40,
  /** Proporção script/texto a partir da qual a página parece só um bundle. */
  maxScriptRatio: 20,
} as const;

/** Containers que os frameworks usam como ponto de montagem. */
const ROOT_SELECTORS = ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', '[data-server-rendered]'];

/**
 * Decide se vale acordar o navegador.
 *
 * A regra do projeto é fetch primeiro; o Playwright é plano B e só entra quando
 * a página vem sem conteúdo. Cada teste aqui evita um clone de página em branco.
 */
export function needsRender($: CheerioDoc): RenderDecision {
  const body = $('body');
  if (body.length === 0) {
    return { render: true, reason: 'sem <body>' };
  }

  const visible = $.root().clone();
  visible.find('script, style, noscript, template, svg').remove();
  const text = visible.find('body').text().replace(/\s+/g, ' ').trim();

  for (const selector of ROOT_SELECTORS) {
    const root = $(selector).first();
    if (root.length === 0) continue;
    const rootText = root.text().replace(/\s+/g, ' ').trim();
    if (root.children().length === 0 && rootText.length < DETECTOR.maxRootText) {
      return { render: true, reason: `container ${selector} está vazio` };
    }
  }

  if (text.length < DETECTOR.minTextLength) {
    const pedeJs = /habilit\w+ o javascript|enable javascript|requires javascript/i.test(
      $('noscript').text(),
    );
    return {
      render: true,
      reason: pedeJs
        ? 'página pede JavaScript e veio quase sem texto'
        : `pouco texto no HTML (${text.length} caracteres)`,
    };
  }

  const scriptLength = $('script')
    .toArray()
    .reduce((total, element) => total + ($(element).html()?.length ?? 0), 0);

  if (text.length > 0 && scriptLength / text.length > DETECTOR.maxScriptRatio) {
    return { render: true, reason: 'muito script para pouco texto' };
  }

  return { render: false, reason: `HTML já veio pronto (${text.length} caracteres)` };
}
