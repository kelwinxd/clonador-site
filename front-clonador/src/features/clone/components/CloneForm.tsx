import { useNavigate } from 'react-router-dom';
import { ROTAS } from '@/shared/constants';
import { SecaoTitulo } from '@/shared/ui/primitives';
import { useClone } from '../CloneContext';

/**
 * Primeira página: só o endereço e o aceite. Links e pixels ficam para DEPOIS do clone (step 2
 * do resultado), porque não faz sentido configurar troca sem antes ver o que a página tem.
 */
export function CloneForm() {
  const app = useClone();
  const navigate = useNavigate();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
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
