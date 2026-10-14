import { lerJson, postJson } from '@/shared/api/client';
import { salvarSessao } from './auth.storage';
import type { Sessao } from './auth.types';

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
    | { token?: string; user?: { email?: string }; message?: string | string[] }
    | null;

  if (!resposta.ok) {
    const msg = corpo?.message;
    throw new AuthError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível entrar.'));
  }
  if (!corpo?.token) throw new AuthError('Resposta inesperada do servidor.');
  return salvarSessao({ token: corpo.token, email: corpo.user?.email ?? email });
}

export function registrar(email: string, senha: string): Promise<Sessao> {
  return pedir('register', email, senha);
}

export function entrar(email: string, senha: string): Promise<Sessao> {
  return pedir('login', email, senha);
}
