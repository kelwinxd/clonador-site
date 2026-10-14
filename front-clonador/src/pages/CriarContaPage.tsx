import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthError, registrar } from '../auth';
import { useApp } from '../state';
import '../Login.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Plano = 'free' | 'pro';

/**
 * Página de criação de conta: e-mail/senha + escolha de plano. A captura de cartão (plano Pro)
 * entra na Etapa 16 via Stripe — o número do cartão nunca passa pelo nosso servidor, por isso
 * NÃO há campos de cartão crus aqui.
 */
export default function CriarContaPage() {
  const app = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [plano, setPlano] = useState<Plano>('free');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) return setErro('Digite um e-mail válido.');
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.');

    setErro(null);
    setEnviando(true);
    try {
      const sessao = await registrar(email.trim(), senha);
      app.entrarComSessao(sessao);
      // Volta para onde dá para usar a conta: a prévia (destrava o download) ou o formulário.
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
        <p className="login-sub">Crie sua conta para baixar e editar seus clones.</p>

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
            autoComplete="new-password"
            required
          />
        </label>

        <div className="rotulo">Plano</div>
        <div className="planos">
          <button
            type="button"
            className={`plano ${plano === 'free' ? 'ativo' : ''}`}
            onClick={() => setPlano('free')}
          >
            <span className="plano-nome">Grátis</span>
            <span className="plano-preco">R$ 0</span>
            <span className="plano-desc">Clones com marca d'água e limite diário.</span>
          </button>
          <button
            type="button"
            className={`plano ${plano === 'pro' ? 'ativo' : ''}`}
            onClick={() => setPlano('pro')}
          >
            <span className="plano-badge">Pro</span>
            <span className="plano-preco">R$ 29<small>/mês</small></span>
            <span className="plano-desc">Clones ilimitados, sem marca d'água, editor completo.</span>
          </button>
        </div>

        {plano === 'pro' && (
          <p className="ajuda plano-aviso">
            💳 O pagamento com cartão será feito pelo Stripe (em breve). Por enquanto a conta é
            criada no plano grátis e você faz o upgrade depois.
          </p>
        )}

        {erro && <span className="campo-erro">{erro}</span>}

        <button type="submit" className="cta" disabled={enviando}>
          {enviando ? 'CRIANDO…' : 'CRIAR CONTA'}
        </button>

        <p className="login-rodape">
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
