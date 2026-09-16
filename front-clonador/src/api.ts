import type { CloneErrorCode, CloneMeta, CloneResult, LinkRule } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Mensagens que o afiliado entende, no lugar do código cru do backend. */
const MENSAGEM_POR_CODIGO: Record<CloneErrorCode, string> = {
  INVALID_URL: 'Esse endereço não parece uma URL válida. Confira se começa com https://',
  BLOCKED_HOST: 'Esse endereço aponta para uma rede interna e foi bloqueado por segurança.',
  BLOCKED_CONTENT: 'O endereço não devolveu uma página HTML. É um PDF ou um arquivo?',
  TIMEOUT: 'O site demorou demais para responder. Tente de novo em instantes.',
  TOO_LARGE: 'A página passou do limite de tamanho permitido.',
  FETCH_FAILED: 'Não consegui acessar a página. Ela pode estar fora do ar ou bloqueando robôs.',
  RENDER_FAILED: 'Não consegui abrir a página no navegador interno.',
  NETWORK: 'Não consegui falar com a API. O backend está rodando?',
};

export class ApiError extends Error {
  readonly code: CloneErrorCode;
  readonly detail?: string;

  constructor(code: CloneErrorCode, detail?: string) {
    super(MENSAGEM_POR_CODIGO[code]);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
  }
}

export interface CloneParams {
  url: string;
  links: LinkRule[];
  acceptedTerms: boolean;
  forceRender?: boolean;
}

/**
 * Chama POST /clone. A resposta é o zip no corpo e o resumo no cabeçalho X-Clone-Meta.
 * Na Etapa 6 isso vira { jobId } + WebSocket; só esta função muda.
 */
export async function cloneSite(params: CloneParams): Promise<CloneResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    throw new ApiError('NETWORK');
  }

  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    const codigo = corpo?.code as CloneErrorCode | undefined;
    const detalhe = Array.isArray(corpo?.message) ? corpo.message.join(' ') : corpo?.message;
    if (codigo && codigo in MENSAGEM_POR_CODIGO) {
      throw new ApiError(codigo, detalhe);
    }
    throw new ApiError('FETCH_FAILED', detalhe ?? `Erro ${response.status}`);
  }

  const cabecalho = response.headers.get('X-Clone-Meta');
  const meta = JSON.parse(decodeURIComponent(cabecalho ?? '')) as CloneMeta;

  return {
    meta,
    blob: await response.blob(),
    fileName: nomeDoArquivo(response.headers.get('Content-Disposition')),
  };
}

function nomeDoArquivo(contentDisposition: string | null): string {
  return contentDisposition?.match(/filename="(.+?)"/)?.[1] ?? 'clone.zip';
}

export function baixarArquivo(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
