import { CheckoutMatch, CheckoutPlatform, CheckoutReport, CheerioDoc } from './types';

/**
 * Detecta links de checkout das plataformas de infoproduto brasileiras.
 *
 * Todo checkout tem uma assinatura reconhecível na URL (o domínio e, muitas vezes, o código
 * do produto). O detector varre os <a href> e <form action> da página, casa cada URL contra
 * a lista de plataformas e devolve o que achou — SEM trocar nada. A troca continua a cargo do
 * link-replacer; aqui o trabalho é só descobrir e reportar, para a interface perguntar ao
 * afiliado qual link entra no lugar.
 *
 * Fica fora do link-replacer de propósito: detectar e substituir são responsabilidades
 * diferentes (uma lê, a outra escreve), e assim cada uma é testada sozinha.
 */

interface PlatformSpec {
  platform: CheckoutPlatform;
  name: string;
  /** Casa a URL de checkout da plataforma. */
  url: RegExp;
  /** Tira o código do produto da URL casada (grupo 1), quando existe. */
  productId?: RegExp;
}

/**
 * Uma entrada por plataforma. Crescer a lista é só adicionar aqui — o resto do motor não muda.
 * Os padrões cobrem os domínios de pagamento mais comuns de cada uma (2026).
 */
const PLATFORMS: PlatformSpec[] = [
  {
    platform: 'hotmart',
    name: 'Hotmart',
    url: /(?:pay\.hotmart\.com|hotmart\.com\/(?:pt-br\/)?(?:product|marketplace\/produto))/i,
    productId: /pay\.hotmart\.com\/([A-Z0-9]+)/i,
  },
  {
    platform: 'kiwify',
    name: 'Kiwify',
    url: /(?:pay\.kiwify\.com\.br|kiwify\.app|kiwify\.com\.br\/[a-z0-9-]+)/i,
    productId: /(?:pay\.kiwify\.com\.br|kiwify\.app)\/([A-Za-z0-9]+)/i,
  },
  {
    platform: 'braip',
    name: 'Braip',
    url: /(?:ev\.braip\.com|checkout\.braip\.com|braip\.com\/checkout)/i,
    productId: /ev\.braip\.com\/([a-z0-9]+)/i,
  },
  {
    platform: 'eduzz',
    name: 'Eduzz',
    url: /(?:sun\.eduzz\.com|chk\.eduzz\.com|eduzz\.com\/[0-9]+)/i,
    productId: /(?:sun|chk)\.eduzz\.com\/(?:[a-z-]+\/)?([0-9A-Za-z]+)/i,
  },
  {
    platform: 'monetizze',
    name: 'Monetizze',
    url: /(?:app\.monetizze\.com\.br\/checkout|checkout\.monetizze\.com\.br|monetizze\.com\.br\/r)/i,
    productId: /monetizze\.com\.br\/(?:checkout\/|r\/)?([A-Za-z0-9]+)/i,
  },
];

export function detectCheckouts($: CheerioDoc): CheckoutReport {
  const matches: CheckoutMatch[] = [];
  const seen = new Set<string>();

  const scan = (selector: string, attr: string, where: 'link' | 'form') => {
    $(selector).each((_, element) => {
      const url = $(element).attr(attr);
      if (!url || !/^https?:/i.test(url)) return;

      const spec = PLATFORMS.find((p) => p.url.test(url));
      if (!spec) return;

      // Mesma URL no mesmo lugar não conta duas vezes.
      const key = `${where}:${url}`;
      if (seen.has(key)) return;
      seen.add(key);

      matches.push({
        platform: spec.platform,
        platformName: spec.name,
        url,
        productId: spec.productId?.exec(url)?.[1],
        where,
      });
    });
  };

  scan('a[href]', 'href', 'link');
  scan('form[action]', 'action', 'form');

  const platforms = [...new Set(matches.map((m) => m.platform))];
  return { matches, platforms };
}
