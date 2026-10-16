import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { montarHtmlAutonomo, montarPreview, type Preview } from '@/features/preview/preview';
import { ApiError } from '@/shared/api/errors';
import { baixarZip, cloneSite, urlPreview } from './clone.api';
import type { CloneInfo, CloneProgress, LinkRule, PixelRule } from './clone.types';
import { obterTokenRecaptcha } from './recaptcha';

export type Status = 'parado' | 'clonando' | 'pronto' | 'erro';

/**
 * Estado do clone, compartilhado entre a página do formulário e a da prévia. Guarda os campos
 * do formulário (para o re-clone com link/pixel pré-preenchido) e o resultado. Reage ao login:
 * ao entrar, baixa o zip (prévia same-origin + editor); ao sair, volta para a prévia do backend.
 */
interface CloneState {
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
  usarCheckout: (url: string) => void;
  usarPixel: (id: string) => void;
}

const Ctx = createContext<CloneState | null>(null);

export function useClone(): CloneState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClone fora do CloneProvider');
  return ctx;
}

export function CloneProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();

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
    if (previaAnterior.current && previaAnterior.current !== previa) previaAnterior.current.descartar();
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
    const [previaObj, htmlAutonomo] = await Promise.all([montarPreview(zip), montarHtmlAutonomo(zip)]);
    setBlob(zip);
    setPrevia(previaObj);
    setPreviewSrc(null);
    setPreviewUrl(URL.createObjectURL(new Blob([htmlAutonomo], { type: 'text/html' })));
  }

  // Reage ao login/logout enquanto há um clone na tela.
  useEffect(() => {
    if (!resultado) return;
    if (sessao && !blob && status === 'pronto') {
      carregarZip(resultado.id, sessao.token).catch(() =>
        setErro('Entrou, mas não consegui preparar o download. Tente clonar de novo.'),
      );
    } else if (!sessao && (blob || previa)) {
      setBlob(null);
      setPrevia(null);
      setPreviewSrc(urlPreview(resultado.id));
    }
    // Só quando a sessão muda: evita laço ao setar blob/prévia aqui dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

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
        const captchaToken = await obterTokenRecaptcha('clone');
        const clone = await cloneSite(
          {
            url: url.trim(),
            acceptedTerms: termos,
            links: links.filter((l) => l.from.trim() && l.to.trim()),
            pixels: pixels.filter((p) => p.from.trim() && p.to.trim()),
            captchaToken,
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

  const valor: CloneState = {
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
    usarCheckout,
    usarPixel,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
