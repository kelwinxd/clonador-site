import { formatarTamanho } from '@/shared/utils';
import type { CloneMeta } from '../clone.types';

/** Resumo numérico do clone + detalhes (arquivos que falharam, links que sobraram). */
export function ResumoClone({ meta }: { meta: CloneMeta }) {
  return (
    <div className="resultado">
      <ul className="numeros">
        <li>
          <strong>{meta.assets}</strong> {meta.assets === 1 ? 'arquivo' : 'arquivos'}
        </li>
        <li>
          <strong>{formatarTamanho(meta.totalBytes)}</strong>
        </li>
        <li>
          <strong>{meta.linksReplaced}</strong>{' '}
          {meta.linksReplaced === 1 ? 'link trocado' : 'links trocados'}
        </li>
        <li>
          <strong>{meta.pixelsReplaced ?? 0}</strong>{' '}
          {(meta.pixelsReplaced ?? 0) === 1 ? 'pixel trocado' : 'pixels trocados'}
        </li>
        <li>
          <strong>{meta.mode === 'fetch' ? 'sem navegador' : 'com navegador'}</strong>
        </li>
      </ul>

      {meta.mode === 'render' && (
        <p className="aviso">
          Página com JavaScript: aberta num navegador e capturada já montada.
          {meta.scriptsRemoved > 0 &&
            ` ${meta.scriptsRemoved} ${meta.scriptsRemoved === 1 ? 'script removido' : 'scripts removidos'} para não montar de novo por cima.`}
        </p>
      )}

      {meta.failedAssets.length > 0 && (
        <details>
          <summary>
            {meta.failedAssets.length === 1
              ? '1 arquivo falhou'
              : `${meta.failedAssets.length} arquivos falharam`}
          </summary>
          <ul className="lista-simples">
            {meta.failedAssets.map((falha) => (
              <li key={falha.url}>
                <code>{falha.url}</code> — {falha.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {meta.remainingLinks.length > 0 && (
        <details>
          <summary>
            {meta.remainingLinks.length === 1
              ? '1 link externo ficou como estava'
              : `${meta.remainingLinks.length} links externos ficaram como estavam`}
          </summary>
          <p className="ajuda">Confira se algum é botão de compra apontando para o produtor.</p>
          <ul className="lista-simples">
            {meta.remainingLinks.map((link) => (
              <li key={link}>
                <code>{link}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
