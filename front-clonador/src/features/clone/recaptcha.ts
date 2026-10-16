import { RECAPTCHA_SITE_KEY } from '@/shared/constants';

/**
 * reCAPTCHA v3 (invisível). Carrega o script do Google uma vez e gera um token por ação.
 * Sem a site key configurada, fica desligado (devolve undefined) — o backend também pula.
 */

interface Grecaptcha {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
}
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

let carregando: Promise<void> | null = null;

/** Injeta o script do reCAPTCHA (idempotente). Chame cedo para o token sair rápido no clique. */
export function prepararRecaptcha(): Promise<void> {
  if (!RECAPTCHA_SITE_KEY || window.grecaptcha) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('falha ao carregar reCAPTCHA'));
    document.head.appendChild(s);
  });
  return carregando;
}

/** Token do reCAPTCHA para uma ação (ex.: 'clone'); undefined se desligado ou se falhar. */
export async function obterTokenRecaptcha(action: string): Promise<string | undefined> {
  if (!RECAPTCHA_SITE_KEY) return undefined;
  try {
    await prepararRecaptcha();
    const g = window.grecaptcha;
    if (!g) return undefined;
    await new Promise<void>((r) => g.ready(() => r()));
    return await g.execute(RECAPTCHA_SITE_KEY, { action });
  } catch {
    return undefined;
  }
}
