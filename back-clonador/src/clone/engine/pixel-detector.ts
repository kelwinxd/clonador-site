import { CheerioDoc, PixelMatch, PixelPlatform, PixelReport } from './types';

/**
 * Detecta pixels de rastreamento e analytics na página: Meta Pixel, GA4, GTM, TikTok e o
 * Universal Analytics (legado). Mesma filosofia do checkout-detector: só ACHA e reporta, não
 * troca. A troca fica no pixel-replacer, guiada pelo ID que o afiliado informar.
 *
 * Os IDs vivem dentro de <script> (inline ou no src) e, no caso do Meta, também na imagem do
 * <noscript> (facebook.com/tr?id=...). Por isso a varredura é sobre o HTML inteiro já montado,
 * usando padrões com contexto (fbq, gtag, ttq.load, o domínio) — nunca só "16 dígitos soltos",
 * para não confundir um número qualquer da página com um pixel.
 */

interface PixelSpec {
  platform: PixelPlatform;
  name: string;
  /** Padrões com grupo 1 = o ID. Vários por plataforma (inline e por URL). */
  patterns: RegExp[];
}

const SPECS: PixelSpec[] = [
  {
    platform: 'meta',
    name: 'Meta Pixel',
    patterns: [
      /fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/gi,
      /facebook\.com\/tr\?id=(\d{8,20})/gi,
    ],
  },
  {
    platform: 'ga4',
    name: 'Google Analytics 4',
    patterns: [
      /gtag\/js\?id=(G-[A-Z0-9]{6,})/gi,
      /['"](G-[A-Z0-9]{6,})['"]/g,
    ],
  },
  {
    platform: 'gtm',
    name: 'Google Tag Manager',
    patterns: [
      /gtm\.js\?id=(GTM-[A-Z0-9]{4,})/gi,
      /['"](GTM-[A-Z0-9]{4,})['"]/g,
    ],
  },
  {
    platform: 'tiktok',
    name: 'TikTok Pixel',
    patterns: [/ttq\.load\(\s*['"]([A-Z0-9]{10,})['"]/gi],
  },
  {
    platform: 'ua',
    name: 'Universal Analytics (antigo)',
    patterns: [/['"](UA-\d{4,}-\d{1,4})['"]/g],
  },
];

export function detectPixels($: CheerioDoc): PixelReport {
  const html = $.html();
  const matches: PixelMatch[] = [];
  const seen = new Set<string>();

  for (const spec of SPECS) {
    for (const pattern of spec.patterns) {
      // Regex global: percorre todas as ocorrências. lastIndex é reiniciado abaixo.
      pattern.lastIndex = 0;
      let hit: RegExpExecArray | null;
      while ((hit = pattern.exec(html)) !== null) {
        const id = hit[1];
        const key = `${spec.platform}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ platform: spec.platform, platformName: spec.name, id });
      }
    }
  }

  return { matches };
}
