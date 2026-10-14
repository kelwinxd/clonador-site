/** Campos de e-mail e senha, reutilizados nas telas de entrar e criar conta. */
export function CamposConta({
  email,
  senha,
  onEmail,
  onSenha,
  senhaPlaceholder = 'sua senha',
  novaSenha = false,
}: {
  email: string;
  senha: string;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  senhaPlaceholder?: string;
  novaSenha?: boolean;
}) {
  return (
    <>
      <label className="campo">
        <span className="rotulo">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
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
          onChange={(e) => onSenha(e.target.value)}
          placeholder={senhaPlaceholder}
          autoComplete={novaSenha ? 'new-password' : 'current-password'}
          required
        />
      </label>
    </>
  );
}
