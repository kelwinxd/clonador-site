/** Configuração e constantes globais do app. */

/** Base da API. Vem do ambiente (Vercel); cai no localhost em desenvolvimento. */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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
