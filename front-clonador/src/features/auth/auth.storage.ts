import { STORAGE_KEYS } from '@/shared/constants';
import type { Sessao } from './auth.types';

/** Persistência da sessão no localStorage (envolvida em try/catch para abas restritas). */

export function lerSessao(): Sessao | null {
  try {
    const cru = localStorage.getItem(STORAGE_KEYS.SESSAO);
    return cru ? (JSON.parse(cru) as Sessao) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(sessao: Sessao): Sessao {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSAO, JSON.stringify(sessao));
  } catch {
    // Sem localStorage (aba anônima/bloqueado): a sessão vive só em memória nesta aba.
  }
  return sessao;
}

export function limparSessao(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSAO);
  } catch {
    // ignora
  }
}
