import { descreveProgresso, porcentagem } from '../clone.utils';
import { useClone } from '../CloneContext';

/**
 * Tela de loading animada (mão ninja pulsando + progresso) enquanto o clone roda.
 * Fica no layout, por cima de tudo, então cobre a página de resultado durante o clone.
 */
export function OverlayClonando() {
  const { status, progresso } = useClone();
  if (status !== 'clonando') return null;

  const pct = porcentagem(progresso);

  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-conteudo">
        <span className="overlay-logo">
          <img src="/logo.png" alt="Clonando" />
        </span>
        <div className="overlay-feedback">
          <div className="barra">
            {pct == null ? (
              <div className="barra-fill indeterminada" />
            ) : (
              <div className="barra-fill" style={{ width: `${pct}%` }} />
            )}
          </div>
          <span>{descreveProgresso(progresso)}</span>
        </div>
      </div>
    </div>
  );
}
