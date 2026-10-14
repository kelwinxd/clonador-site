import { createContext, useContext, useState, type ReactNode } from 'react';
import { entrar as apiEntrar, registrar as apiRegistrar } from './auth.api';
import { lerSessao, limparSessao } from './auth.storage';
import type { Sessao } from './auth.types';

/** Estado de autenticação. Login é opcional no app; aqui mora a sessão e as ações de conta. */
interface AuthState {
  sessao: Sessao | null;
  registrar: (email: string, senha: string) => Promise<Sessao>;
  entrar: (email: string, senha: string) => Promise<Sessao>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());

  async function registrar(email: string, senha: string): Promise<Sessao> {
    const nova = await apiRegistrar(email, senha);
    setSessao(nova);
    return nova;
  }

  async function entrar(email: string, senha: string): Promise<Sessao> {
    const nova = await apiEntrar(email, senha);
    setSessao(nova);
    return nova;
  }

  function logout(): void {
    limparSessao();
    setSessao(null);
  }

  return <Ctx.Provider value={{ sessao, registrar, entrar, logout }}>{children}</Ctx.Provider>;
}
