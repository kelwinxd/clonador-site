import { CheerioDoc } from './html-rewriter';

export interface LinkRule {
  /** Trecho que identifica o link original (ex.: pay.hotmart.com/XXXX). */
  from: string;
  /** Link do afiliado que entra no lugar. */
  to: string;
}

export interface ReplaceReport {
  replaced: number;
  /** Links de saída que sobraram sem troca — a interface mostra para o afiliado conferir. */
  remaining: string[];
}

/**
 * Troca os links de compra pelo link do afiliado.
 * A detecção automática de checkout (Hotmart, Braip, Kiwify...) entra na Fase 2;
 * aqui a troca é explícita, com as regras que o usuário mandou.
 */
export function replaceLinks($: CheerioDoc, rules: LinkRule[]): ReplaceReport {
  let replaced = 0;

  const applyTo = (selector: string, attr: string) => {
    $(selector).each((_, element) => {
      const node = $(element);
      const value = node.attr(attr);
      if (!value) return;
      const rule = rules.find((item) => value.toLowerCase().includes(item.from.toLowerCase()));
      if (rule) {
        node.attr(attr, rule.to);
        replaced += 1;
      }
    });
  };

  applyTo('a[href]', 'href');
  applyTo('form[action]', 'action');

  const remaining = new Set<string>();
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    if (/^https?:/i.test(href) && !rules.some((rule) => href === rule.to)) {
      remaining.add(href);
    }
  });

  return { replaced, remaining: [...remaining] };
}
