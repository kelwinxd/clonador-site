import { PLANOS } from '../auth.constants';
import type { PlanoId } from '../auth.types';

/** Cartões de escolha de plano. O pagamento do Pro entra na Etapa 16 (Stripe). */
export function PlanoSelector({
  selecionado,
  onSelecionar,
}: {
  selecionado: PlanoId;
  onSelecionar: (id: PlanoId) => void;
}) {
  return (
    <>
      <div className="rotulo">Plano</div>
      <div className="planos">
        {PLANOS.map((plano) => (
          <button
            key={plano.id}
            type="button"
            className={`plano ${selecionado === plano.id ? 'ativo' : ''}`}
            onClick={() => onSelecionar(plano.id)}
          >
            <span className={plano.id === 'pro' ? 'plano-badge' : 'plano-nome'}>{plano.nome}</span>
            <span className="plano-preco">
              {plano.preco}
              {plano.periodo && <small>{plano.periodo}</small>}
            </span>
            <span className="plano-desc">{plano.descricao}</span>
          </button>
        ))}
      </div>
    </>
  );
}
