import { API_URL } from './api';

/**
 * Contas no front (Etapa 15). Login é opcional: clonar e pré-visualizar são livres; baixar o
 * zip exige estar logado. O token (JWT) fica no localStorage e vai no header do download.
 */

export interface Sessao {
  token: string;
  email: string;
}

const CHAVE = 'cn_sessao';

export function sessaoAtual(): Sessao | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    return cru ? (JSON.parse(cru) as Sessao) : null;
  } catch {
    return null;
  }
}

function salvar(sessao: Sessao): Sessao {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // sem localStorage (aba anônima/bloqueado): a sessão vive só em memória nesta aba.
  }
  return sessao;
}

export function sair(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}

export class AuthError extends Error {}

async function pedir(caminho: 'register' | 'login', email: string, senha: string): Promise<Sessao> {
  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}/auth/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
  } catch {
    throw new AuthError('Não consegui falar com o servidor. Tente de novo.');
  }

  const corpo = (await resposta.json().catch(() => null)) as
    | { token?: string; user?: { email?: string }; message?: string | string[] }
    | null;

  if (!resposta.ok) {
    const msg = corpo?.message;
    throw new AuthError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível entrar.'));
  }
  if (!corpo?.token) throw new AuthError('Resposta inesperada do servidor.');
  return salvar({ token: corpo.token, email: corpo.user?.email ?? email });
}

export function registrar(email: string, senha: string): Promise<Sessao> {
  return pedir('register', email, senha);
}

export function entrar(email: string, senha: string): Promise<Sessao> {
  return pedir('login', email, senha);
}
