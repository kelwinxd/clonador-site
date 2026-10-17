import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { buscarCreditos, entrar as apiEntrar, registrar as apiRegistrar } from './auth.api';
import { lerSessao, limparSessao } from './auth.storage';
import type { Creditos, Sessao } from './auth.types';

/** Estado de autenticação + créditos do ciclo. */
interface AuthState {
  sessao: Sessao | null;
  creditos: Creditos | null;
  registrar: (email: string, senha: string) => Promise<Sessao>;
  entrar: (email: string, senha: string) => Promise<Sessao>;
  logout: () => void;
  /** Rebusca os créditos (ex.: depois de um clone). */
  atualizarCreditos: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());
  const [creditos, setCreditos] = useState<Creditos | null>(null);

  function atualizarCreditos() {
    if (!sessao) return;
    void buscarCreditos(sessao.token).then((c) => c && setCreditos(c));
  }

  // Ao entrar (ou já estar logado), carrega os créditos.
  useEffect(() => {
    if (!sessao) {
      setCreditos(null);
      return;
    }
    void buscarCreditos(sessao.token).then((c) => c && setCreditos(c));
  }, [sessao]);

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

  return (
    <Ctx.Provider value={{ sessao, creditos, registrar, entrar, logout, atualizarCreditos }}>
      {children}
    </Ctx.Provider>
  );
}
