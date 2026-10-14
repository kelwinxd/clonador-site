import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  baixarZip,
  cloneSite,
  urlPreview,
  type CloneInfo,
  type CloneProgress,
} from './api';
import { sair, sessaoAtual, type Sessao } from './auth';
import { montarHtmlAutonomo, montarPreview, type Preview } from './preview';
import type { LinkRule, PixelRule } from './types';

export type Status = 'parado' | 'clonando' | 'pronto' | 'erro';

/**
 * Estado compartilhado entre as páginas (formulário, prévia, conta). Mora acima das rotas,
 * então o clone feito na página do formulário continua disponível na página da prévia, e o
 * login sobrevive à navegação. Centraliza também o fluxo assíncrono do clone.
 */
interface AppState {
  sessao: Sessao | null;
  entrarComSessao: (s: Sessao) => void;
  logout: () => void;

  // Formulário
  url: string;
  setUrl: (v: string) => void;
  links: LinkRule[];
  setLinks: React.Dispatch<React.SetStateAction<LinkRule[]>>;
  pixels: PixelRule[];
  setPixels: React.Dispatch<React.SetStateAction<PixelRule[]>>;
  termos: boolean;
  setTermos: (v: boolean) => void;

  // Clone / prévia
  status: Status;
  progresso: CloneProgress | null;
  resultado: CloneInfo | null;
  blob: Blob | null;
  previa: Preview | null;
  previewUrl: string | null;
  previewSrc: string | null;
  erro: string | null;

  iniciarClone: () => void;
  carregarZip: (id: string, token: string) => Promise<void>;
  usarCheckout: (url: string) => void;
  usarPixel: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => sessaoAtual());

  const [url, setUrl] = useState('');
  const [links, setLinks] = useState<LinkRule[]>([{ from: '', to: '' }]);
  const [pixels, setPixels] = useState<PixelRule[]>([{ from: '', to: '' }]);
  const [termos, setTermos] = useState(false);

  const [status, setStatus] = useState<Status>('parado');
  const [progresso, setProgresso] = useState<CloneProgress | null>(null);
  const [resultado, setResultado] = useState<CloneInfo | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previa, setPrevia] = useState<Preview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const previaAnterior = useRef<Preview | null>(null);
  const previewUrlAnterior = useRef<string | null>(null);

  // Libera os endereços temporários da prévia quando trocam.
  useEffect(() => {
    if (previaAnterior.current && previaAnterior.current !== previa) {
      previaAnterior.current.descartar();
    }
    previaAnterior.current = previa;
  }, [previa]);

  useEffect(() => {
    if (previewUrlAnterior.current && previewUrlAnterior.current !== previewUrl) {
      URL.revokeObjectURL(previewUrlAnterior.current);
    }
    previewUrlAnterior.current = previewUrl;
  }, [previewUrl]);

  async function carregarZip(id: string, token: string) {
    const zip = await baixarZip(id, token);
    const [previaObj, htmlAutonomo] = await Promise.all([
      montarPreview(zip),
      montarHtmlAutonomo(zip),
    ]);
    setBlob(zip);
    setPrevia(previaObj);
    setPreviewSrc(null);
    setPreviewUrl(URL.createObjectURL(new Blob([htmlAutonomo], { type: 'text/html' })));
  }

  function iniciarClone() {
    setStatus('clonando');
    setErro(null);
    setResultado(null);
    setBlob(null);
    setPrevia(null);
    setPreviewUrl(null);
    setPreviewSrc(null);
    setProgresso(null);

    void (async () => {
      try {
        const clone = await cloneSite(
          {
            url: url.trim(),
            acceptedTerms: termos,
            links: links.filter((l) => l.from.trim() && l.to.trim()),
            pixels: pixels.filter((p) => p.from.trim() && p.to.trim()),
          },
          setProgresso,
        );
        setResultado(clone);
        if (sessao) await carregarZip(clone.id, sessao.token);
        else setPreviewSrc(urlPreview(clone.id));
        setStatus('pronto');
      } catch (problema) {
        const apiError = problema instanceof ApiError ? problema : null;
        setErro(apiError?.message ?? 'Algo deu errado ao clonar. Tente de novo.');
        setStatus('erro');
      }
    })();
  }

  function entrarComSessao(nova: Sessao) {
    setSessao(nova);
    // Se há um clone anônimo pronto, destrava o zip (prévia same-origin + editor).
    if (resultado && !blob) {
      carregarZip(resultado.id, nova.token).catch(() =>
        setErro('Entrou, mas não consegui preparar o download. Tente clonar de novo.'),
      );
    }
  }

  function logout() {
    sair();
    setSessao(null);
    setBlob(null);
    setPrevia(null);
    if (resultado) setPreviewSrc(urlPreview(resultado.id));
  }

  function usarCheckout(checkoutUrl: string) {
    setLinks((atual) => {
      if (atual.some((l) => l.from.trim() === checkoutUrl)) return atual;
      const vazia = atual.findIndex((l) => !l.from.trim() && !l.to.trim());
      if (vazia >= 0) return atual.map((l, i) => (i === vazia ? { from: checkoutUrl, to: '' } : l));
      return [...atual, { from: checkoutUrl, to: '' }];
    });
  }

  function usarPixel(pixelId: string) {
    setPixels((atual) => {
      if (atual.some((p) => p.from.trim() === pixelId)) return atual;
      const vazia = atual.findIndex((p) => !p.from.trim() && !p.to.trim());
      if (vazia >= 0) return atual.map((p, i) => (i === vazia ? { from: pixelId, to: '' } : p));
      return [...atual, { from: pixelId, to: '' }];
    });
  }

  const valor: AppState = {
    sessao,
    entrarComSessao,
    logout,
    url,
    setUrl,
    links,
    setLinks,
    pixels,
    setPixels,
    termos,
    setTermos,
    status,
    progresso,
    resultado,
    blob,
    previa,
    previewUrl,
    previewSrc,
    erro,
    iniciarClone,
    carregarZip,
    usarCheckout,
    usarPixel,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
