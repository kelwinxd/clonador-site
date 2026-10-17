import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthError } from '@/features/auth/auth.api';
import type { PlanoId } from '@/features/auth/auth.types';
import { useAuth } from '@/features/auth/AuthContext';
import { CamposConta } from '@/features/auth/components/CamposConta';
import { PlanoSelector } from '@/features/auth/components/PlanoSelector';
import { TermosModal } from '@/features/auth/components/TermosModal';
import { useClone } from '@/features/clone/CloneContext';
import { ROTAS } from '@/shared/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Criação de conta: e-mail/senha + plano. Pagamento do Pro entra na Etapa 16 (Stripe). */
export default function CriarContaPage() {
  const { registrar } = useAuth();
  const { resultado, clonarAoLogar } = useClone();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [plano, setPlano] = useState<PlanoId>('free');
  const [aceitou, setAceitou] = useState(false);
  const [modalTermos, setModalTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) return setErro('Digite um e-mail válido.');
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.');
    if (!aceitou) return setErro('É preciso aceitar os termos de uso e a política de privacidade.');

    setErro(null);
    setEnviando(true);
    try {
      await registrar(email.trim(), senha);
      navigate(clonarAoLogar || resultado ? ROTAS.resultado : ROTAS.clonar);
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
        <p className="login-sub">Crie sua conta para clonar — 3 clones grátis por mês.</p>

        <CamposConta
          email={email}
          senha={senha}
          onEmail={(v) => {
            setEmail(v);
            if (erro) setErro(null);
          }}
          onSenha={setSenha}
          senhaPlaceholder="pelo menos 6 caracteres"
          novaSenha
        />

        <PlanoSelector selecionado={plano} onSelecionar={setPlano} />

        {plano === 'pro' && (
          <p className="ajuda plano-aviso">
            💳 O pagamento com cartão será feito pelo Stripe (em breve). Por enquanto a conta é criada
            no plano grátis e você faz o upgrade depois.
          </p>
        )}

        <label className="termo-lgpd">
          <input
            type="checkbox"
            checked={aceitou}
            onChange={(e) => {
              setAceitou(e.target.checked);
              if (erro) setErro(null);
            }}
          />
          <span>
            Li e aceito os{' '}
            <button type="button" className="link-termos" onClick={() => setModalTermos(true)}>
              Termos de Uso e a Política de Privacidade
            </button>{' '}
            (LGPD).
          </span>
        </label>

        {erro && <span className="campo-erro">{erro}</span>}

        <button type="submit" className="cta" disabled={enviando}>
          {enviando ? 'CRIANDO…' : 'CRIAR CONTA'}
        </button>

        <p className="login-rodape">
          Já tem conta? <Link to={ROTAS.entrar}>Entrar</Link>
        </p>
      </form>

      {modalTermos && <TermosModal onFechar={() => setModalTermos(false)} />}
    </div>
  );
}
