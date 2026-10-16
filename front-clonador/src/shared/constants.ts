/** Configuração e constantes globais do app. */

/** Base da API. Vem do ambiente (Vercel); cai no localhost em desenvolvimento. */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Site key do reCAPTCHA v3 (público). Vazio = reCAPTCHA desligado (dev). */
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';

/** Chaves do localStorage, num lugar só para não espalhar strings mágicas. */
export const STORAGE_KEYS = {
  SESSAO: 'cn_sessao',
} as const;

/** Rotas do app (evita URLs soltas pelos componentes). */
export const ROTAS = {
  clonar: '/',
  resultado: '/resultado',
  editor: '/editor',
  criarConta: '/criar-conta',
  entrar: '/entrar',
} as const;
