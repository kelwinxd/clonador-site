import { lerJson, postJson, request } from '@/shared/api/client';
import { salvarSessao } from './auth.storage';
import type { Creditos, Sessao } from './auth.types';

/** Erro de autenticação com mensagem pronta para a tela. */
export class AuthError extends Error {}

async function pedir(caminho: 'register' | 'login', email: string, senha: string): Promise<Sessao> {
  let resposta: Response;
  try {
    resposta = await postJson(`/auth/${caminho}`, { email, senha });
  } catch {
    throw new AuthError('Não consegui falar com o servidor. Tente de novo.');
  }

  const corpo = (await lerJson(resposta)) as
    | { token?: string; user?: { email?: string; plano?: string }; message?: string | string[] }
    | null;

  if (!resposta.ok) {
    const msg = corpo?.message;
    throw new AuthError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível entrar.'));
  }
  if (!corpo?.token) throw new AuthError('Resposta inesperada do servidor.');
  return salvarSessao({
    token: corpo.token,
    email: corpo.user?.email ?? email,
    plano: corpo.user?.plano ?? 'free',
  });
}

export function registrar(email: string, senha: string): Promise<Sessao> {
  return pedir('register', email, senha);
}

export function entrar(email: string, senha: string): Promise<Sessao> {
  return pedir('login', email, senha);
}

/** Busca os créditos atuais do usuário (GET /auth/me). null se falhar/sessão inválida. */
export async function buscarCreditos(token: string): Promise<Creditos | null> {
  try {
    const resp = await request('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const corpo = (await lerJson(resp)) as { creditos?: Creditos } | null;
    return corpo?.creditos ?? null;
  } catch {
    return null;
  }
}
