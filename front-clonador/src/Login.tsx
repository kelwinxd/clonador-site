import { useState } from 'react';
import './App.css'; // reaproveita .cta, .campo, inputs
import './Login.css';

// Validação simples de formato de e-mail (sem lógica de backend ainda).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login({ onEntrar }: { onEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroEmail, setErroEmail] = useState<string | null>(null);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) {
      setErroEmail('Digite um e-mail válido.');
      return;
    }
    setErroEmail(null);
    // Sem autenticação de verdade ainda: qualquer e-mail válido entra.
    onEntrar();
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-brand">
          <span className="logo">
            <img src="/logo.png" alt="" width="64" height="64" />
          </span>
          <span className="brand-nome">
            CLONE <span className="brand-ninja">NINJA</span>
          </span>
        </div>

        <p className="login-sub">Entre para clonar suas páginas.</p>

        <label className="campo">
          <span className="rotulo">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (erroEmail) setErroEmail(null);
            }}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            aria-invalid={erroEmail ? true : undefined}
            required
          />
          {erroEmail && <span className="campo-erro">{erroEmail}</span>}
        </label>

        <label className="campo">
          <span className="rotulo">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="cta">
          ENTRAR
        </button>

        <p className="login-rodape">
          Ainda não tem conta? <a href="#criar">Criar conta</a>
        </p>
      </form>
    </div>
  );
}
