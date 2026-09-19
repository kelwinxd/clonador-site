import { useEffect, useRef, useState } from 'react';
import './App.css';
import { ApiError, baixarArquivo, cloneSite, type CloneProgress } from './api';
import { montarPreview, type Preview } from './preview';
import type { CloneResult, LinkRule } from './types';

type Status = 'parado' | 'clonando' | 'pronto' | 'erro';

const TEXTO_ESTAGIO: Record<CloneProgress['stage'], string> = {
  fetching: 'Buscando a página…',
  rendering: 'Abrindo no navegador (a página depende de JavaScript)…',
  downloading: 'Baixando os arquivos…',
  packaging: 'Montando o .zip…',
};

function descreveProgresso(progresso: CloneProgress | null): string {
  if (!progresso) return 'Entrando na fila…';
  const base = TEXTO_ESTAGIO[progresso.stage];
  if (progresso.stage === 'downloading' && progresso.total) {
    return `Baixando os arquivos… ${progresso.done ?? 0}/${progresso.total}`;
  }
  return base;
}

export default function App() {
  const [url, setUrl] = useState('http://localhost:4173/ssr.html');
  const [links, setLinks] = useState<LinkRule[]>([{ from: '', to: '' }]);
  const [termos, setTermos] = useState(false);
  const [status, setStatus] = useState<Status>('parado');
  const [resultado, setResultado] = useState<CloneResult | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null);
  const [previa, setPrevia] = useState<Preview | null>(null);
  const [progresso, setProgresso] = useState<CloneProgress | null>(null);
  const previaAnterior = useRef<Preview | null>(null);

  // Os endereços temporários da prévia precisam ser liberados quando trocam ou ao sair.
  useEffect(() => {
    previaAnterior.current?.descartar();
    previaAnterior.current = previa;
    return () => previa?.descartar();
  }, [previa]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setStatus('clonando');
    setErro(null);
    setResultado(null);
    setPrevia(null);
    setProgresso(null);

    try {
      const clone = await cloneSite(
        {
          url: url.trim(),
          acceptedTerms: termos,
          links: links.filter((link) => link.from.trim() && link.to.trim()),
        },
        setProgresso,
      );
      setResultado(clone);
      setPrevia(await montarPreview(clone.blob));
      setStatus('pronto');
    } catch (problema) {
      const apiError = problema instanceof ApiError ? problema : null;
      setErro({
        mensagem: apiError?.message ?? 'Algo deu errado ao clonar.',
        detalhe: apiError?.detail,
      });
      setStatus('erro');
    }
  }

  function atualizarLink(indice: number, campo: keyof LinkRule, valor: string) {
    setLinks((atual) =>
      atual.map((link, posicao) => (posicao === indice ? { ...link, [campo]: valor } : link)),
    );
  }

  const clonando = status === 'clonando';

  return (
    <div className="pagina">
      <header className="cabecalho">
        <h1>Clonador de páginas</h1>
        <p>Clone uma página autorizada e baixe um .zip pronto para hospedar, com o seu link no lugar.</p>
      </header>

      <form className="cartao" onSubmit={enviar}>
        <label className="campo">
          <span className="rotulo">Endereço da página</span>
          <input
            type="url"
            value={url}
            onChange={(evento) => setUrl(evento.target.value)}
            placeholder="https://pagina-do-produtor.com/oferta"
            required
          />
        </label>

        <fieldset className="campo">
          <legend className="rotulo">Links para trocar</legend>
          <p className="ajuda">
            À esquerda, um trecho do link de compra que está na página. À direita, o seu link de
            afiliado. A detecção automática de checkout chega na Etapa 11.
          </p>

          {links.map((link, indice) => (
            <div className="linha-link" key={indice}>
              <input
                value={link.from}
                onChange={(evento) => atualizarLink(indice, 'from', evento.target.value)}
                placeholder="pay.hotmart.com/B12345678X"
              />
              <span className="seta" aria-hidden="true">
                →
              </span>
              <input
                type="url"
                value={link.to}
                onChange={(evento) => atualizarLink(indice, 'to', evento.target.value)}
                placeholder="https://go.hotmart.com/SEU-ID"
              />
              <button
                type="button"
                className="botao-icone"
                aria-label={`Remover troca ${indice + 1}`}
                onClick={() => setLinks((atual) => atual.filter((_, posicao) => posicao !== indice))}
                disabled={links.length === 1}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="botao-secundario"
            onClick={() => setLinks((atual) => [...atual, { from: '', to: '' }])}
          >
            + adicionar troca
          </button>
        </fieldset>

        <label className="termo">
          <input
            type="checkbox"
            checked={termos}
            onChange={(evento) => setTermos(evento.target.checked)}
            required
          />
          <span>
            Declaro que tenho autorização para clonar esta página. A ferramenta não serve para
            copiar página de terceiro sem permissão nem para phishing.
          </span>
        </label>

        <button type="submit" className="botao-principal" disabled={clonando || !termos}>
          {clonando ? 'Clonando…' : 'Clonar página'}
        </button>

        {clonando && (
          <div className="progresso" role="status">
            <div className="barra" />
            <span>{descreveProgresso(progresso)}</span>
          </div>
        )}
      </form>

      {erro && (
        <div className="cartao erro" role="alert">
          <strong>{erro.mensagem}</strong>
          {erro.detalhe && <p className="detalhe">{erro.detalhe}</p>}
        </div>
      )}

      {resultado && <Resultado clone={resultado} />}

      {previa && (
        <section className="cartao">
          <h2>Prévia</h2>
          <p className="ajuda">
            O zip é aberto aqui no navegador, sem passar pelo servidor. Os scripts ficam desligados.
          </p>
          <iframe className="previa" title="Prévia do clone" sandbox="allow-same-origin" srcDoc={previa.html} />
        </section>
      )}
    </div>
  );
}

function Resultado({ clone }: { clone: CloneResult }) {
  const { meta } = clone;

  return (
    <section className="cartao">
      <div className="topo-resultado">
        <h2>Clone pronto</h2>
        <button className="botao-principal" onClick={() => baixarArquivo(clone.blob, clone.fileName)}>
          Baixar {clone.fileName}
        </button>
      </div>

      <ul className="numeros">
        <li>
          <strong>{meta.assets}</strong> {meta.assets === 1 ? 'arquivo' : 'arquivos'}
        </li>
        <li>
          <strong>{formatarTamanho(meta.totalBytes)}</strong> baixados
        </li>
        <li>
          <strong>{meta.linksReplaced}</strong>{' '}
          {meta.linksReplaced === 1 ? 'link trocado' : 'links trocados'}
        </li>
        <li>
          <strong>{meta.mode === 'fetch' ? 'sem navegador' : 'com navegador'}</strong> — {meta.reason}
        </li>
      </ul>

      {meta.mode === 'render' && (
        <p className="aviso">
          Esta página depende de JavaScript, então foi aberta num navegador e capturada já montada.
          {meta.scriptsRemoved > 0 &&
            ` ${meta.scriptsRemoved} ${meta.scriptsRemoved === 1 ? 'script foi removido' : 'scripts foram removidos'} para o clone não montar a página de novo por cima.`}
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
          <p className="ajuda">Confira se algum deles é botão de compra apontando para o produtor.</p>
          <ul className="lista-simples">
            {meta.remainingLinks.map((link) => (
              <li key={link}>
                <code>{link}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
