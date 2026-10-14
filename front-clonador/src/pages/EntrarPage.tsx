import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthError } from '@/features/auth/auth.api';
import { useAuth } from '@/features/auth/AuthContext';
import { CamposConta } from '@/features/auth/components/CamposConta';
import { useClone } from '@/features/clone/CloneContext';
import { ROTAS } from '@/shared/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Login de quem já tem conta. */
export default function EntrarPage() {
  const { entrar } = useAuth();
  const { resultado } = useClone();
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
      await entrar(email.trim(), senha);
      navigate(resultado ? ROTAS.resultado : ROTAS.clonar);
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

        <CamposConta
          email={email}
          senha={senha}
          onEmail={(v) => {
            setEmail(v);
            if (erro) setErro(null);
          }}
          onSenha={setSenha}
        />

        {erro && <span className="campo-erro">{erro}</span>}

        <button type="submit" className="cta" disabled={enviando}>
          {enviando ? 'ENTRANDO…' : 'ENTRAR'}
        </button>

        <p className="login-rodape">
          Ainda não tem conta? <Link to={ROTAS.criarConta}>Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
