import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { ROTAS } from '@/shared/constants';
import { SecaoTitulo } from '@/shared/ui/primitives';
import { useClone } from '../CloneContext';
import { prepararRecaptcha } from '../recaptcha';

/**
 * Primeira página: só o endereço e o aceite. Links e pixels ficam para DEPOIS do clone (step 2).
 * Clonar exige login — mas o login só é pedido ao CLICAR em clonar (a landing fica pública).
 */
export function CloneForm() {
  const app = useClone();
  const { sessao } = useAuth();
  const navigate = useNavigate();

  // Carrega o reCAPTCHA cedo, para o token sair rápido ao clicar em clonar.
  useEffect(() => {
    void prepararRecaptcha();
  }, []);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!sessao) {
      // Sem login: guarda a intenção e manda criar conta; ao logar, o clone dispara sozinho.
      app.setClonarAoLogar(true);
      navigate(ROTAS.criarConta);
      return;
    }
    app.iniciarClone();
    navigate(ROTAS.resultado);
  }

  return (
    <form className="painel painel-form" onSubmit={enviar}>
      <SecaoTitulo numero={1} titulo="Qual página você quer clonar?" />

      <label className="campo">
        <span className="rotulo">Endereço da página</span>
        <input
          type="url"
          value={app.url}
          onChange={(e) => app.setUrl(e.target.value)}
          placeholder="https://pagina-do-produtor.com/oferta"
          required
          autoFocus
        />
      </label>

      <label className="termo">
        <input
          type="checkbox"
          checked={app.termos}
          onChange={(e) => app.setTermos(e.target.checked)}
          required
        />
        <span>Declaro que tenho autorização para clonar esta página.</span>
      </label>

      <button type="submit" className="cta" disabled={!app.termos}>
        CLONAR PÁGINA
      </button>
    </form>
  );
}
