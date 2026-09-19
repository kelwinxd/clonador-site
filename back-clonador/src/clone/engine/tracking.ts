/**
 * Rastreadores conhecidos (pixels e analytics).
 *
 * Usados de dois jeitos opostos:
 * - durante a renderização, as requisições para esses domínios são bloqueadas (não ajudam a
 *   montar a página e só gastam tempo);
 * - no HTML final, as tags deles são mantidas, porque a Etapa 12 troca o ID pelo do afiliado.
 */
export const TRACKING_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'analytics.tiktok.com',
  'hotjar.com',
  'clarity.ms',
  'cdn.segment.com',
  'mxpnl.com',
  'snap.licdn.com',
];

export function isTrackingHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return TRACKING_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Trechos típicos dos códigos de pixel colados direto no HTML. */
export const TRACKING_SNIPPET = /\b(fbq|gtag|ttq|clarity|hj)\s*\(|\bdataLayer\b|\b_hsq\b/;
