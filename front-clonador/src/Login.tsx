import { useState } from 'react';
import './App.css'; // reaproveita .cta, .campo, inputs
import './Login.css';
import { AuthError, entrar, registrar, type Sessao } from './auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Modo = 'entrar' | 'criar';

/**
 * Modal de conta. Login é opcional no app; este modal abre quando o anônimo tenta baixar/editar,
 * ou pelo botão "Entrar". Faz login OU cadastro de verdade contra a API e devolve a sessão.
 */
export function Login({
  onSucesso,
  onFechar,
  motivo,
}: {
  onSucesso: (sessao: Sessao) => void;
  onFechar: () => void;
  /** Texto opcional explicando por que o modal abriu (ex.: "Crie conta para baixar"). */
  motivo?: string;
}) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) return setErro('Digite um e-mail válido.');
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.');

    setErro(null);
    setEnviando(true);
    try {
      const sessao =
        modo === 'entrar' ? await entrar(email.trim(), senha) : await registrar(email.trim(), senha);
      onSucesso(sessao);
    } catch (problema) {
      setErro(problema instanceof AuthError ? problema.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-overlay" role="dialog" aria-modal="true" onClick={onFechar}>
      <form className="login-card" onSubmit={enviar} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-fechar" aria-label="Fechar" onClick={onFechar}>
          ×
        </button>

        <div className="login-brand">
          <span className="logo">
            <img src="/logo.png" alt="" width="64" height="64" />
          </span>
          <span className="brand-nome">
            CLONE <span className="brand-ninja">NINJA</span>
          </span>
        </div>

        <p className="login-sub">
          {motivo ?? (modo === 'entrar' ? 'Entre para baixar e editar seus clones.' : 'Crie sua conta.')}
        </p>

        <label className="campo">
          <span className="rotulo">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (erro) setErro(null);
            }}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="campo">
          <span className="rotulo">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="pelo menos 6 caracteres"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        {erro && <span className="campo-erro">{erro}</span>}

        <button type="submit" className="cta" disabled={enviando}>
          {enviando ? 'AGUARDE…' : modo === 'entrar' ? 'ENTRAR' : 'CRIAR CONTA'}
        </button>

        <p className="login-rodape">
          {modo === 'entrar' ? (
            <>
              Ainda não tem conta?{' '}
              <a href="#criar" onClick={(e) => (e.preventDefault(), setModo('criar'), setErro(null))}>
                Criar conta
              </a>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <a href="#entrar" onClick={(e) => (e.preventDefault(), setModo('entrar'), setErro(null))}>
                Entrar
              </a>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
