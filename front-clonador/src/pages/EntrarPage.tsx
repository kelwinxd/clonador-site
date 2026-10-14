import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthError, entrar } from '../auth';
import { useApp } from '../state';
import '../Login.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Página de login. Login é opcional no app; aqui é o acesso de quem já tem conta. */
export default function EntrarPage() {
  const app = useApp();
  const navigate = useNavigate();

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
      const sessao = await entrar(email.trim(), senha);
      app.entrarComSessao(sessao);
      navigate(app.resultado ? '/resultado' : '/');
    } catch (problema) {
      setErro(problema instanceof AuthError ? problema.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-pagina">
      <form className="auth-card" onSubmit={enviar}>
        <div className="login-brand">
          <span className="logo">
            <img src="/logo.png" alt="" width="56" height="56" />
          </span>
          <span className="brand-nome">
            CLONE <span className="brand-ninja">NINJA</span>
          </span>
        </div>
        <p className="login-sub">Entre para baixar e editar seus clones.</p>

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
            placeholder="sua senha"
            autoComplete="current-password"
            required
          />
        </label>

        {erro && <span className="campo-erro">{erro}</span>}

        <button type="submit" className="cta" disabled={enviando}>
          {enviando ? 'ENTRANDO…' : 'ENTRAR'}
        </button>

        <p className="login-rodape">
          Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
