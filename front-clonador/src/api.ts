import { io, type Socket } from 'socket.io-client';
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

/** Estágios que o backend reporta enquanto o clone roda. */
export type CloneStage = 'fetching' | 'rendering' | 'downloading' | 'packaging';

export interface CloneProgress {
  stage: CloneStage;
  done?: number;
  total?: number;
}

type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';

interface StatusResponse {
  id: string;
  state: JobState;
  progress: CloneProgress | null;
  result: { fileName: string; meta: CloneMeta } | null;
  error: { code: string; message: string } | null;
}

async function lerJson(response: Response): Promise<Record<string, unknown> | null> {
  return response.json().catch(() => null);
}

function erroDoCorpo(corpo: Record<string, unknown> | null, status: number): ApiError {
  const codigo = corpo?.code as CloneErrorCode | undefined;
  const msg = corpo?.message;
  const detalhe = Array.isArray(msg) ? msg.join(' ') : (msg as string | undefined);
  if (codigo && codigo in MENSAGEM_POR_CODIGO) return new ApiError(codigo, detalhe);
  return new ApiError('FETCH_FAILED', detalhe ?? `Erro ${status}`);
}

/**
 * A API é assíncrona: enfileira o job, acompanha o progresso (por WebSocket, com polling
 * de reserva) e, quando termina, baixa o zip.
 */
export async function cloneSite(
  params: CloneParams,
  onProgress?: (progress: CloneProgress) => void,
): Promise<CloneResult> {
  const id = await enfileirar(params);
  const info = await acompanhar(id, onProgress);
  const blob = await baixarZip(id);

  return { meta: info.meta, blob, fileName: info.fileName };
}

interface ResultadoInfo {
  fileName: string;
  meta: CloneMeta;
}

/**
 * Acompanha o job por WebSocket. Se o socket não conectar (rede, proxy, servidor sem
 * gateway), cai no polling — as pontas (enfileirar e baixar) não mudam.
 */
async function acompanhar(
  id: string,
  onProgress?: (progress: CloneProgress) => void,
): Promise<ResultadoInfo> {
  try {
    return await acompanharPorWebSocket(id, onProgress);
  } catch (problema) {
    if (problema instanceof ApiError) throw problema; // job falhou de verdade
    return acompanharPorPolling(id, onProgress); // socket indisponível
  }
}

async function enfileirar(params: CloneParams): Promise<string> {
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
  if (!response.ok) throw erroDoCorpo(await lerJson(response), response.status);
  const corpo = (await lerJson(response)) as { id?: string } | null;
  if (!corpo?.id) throw new ApiError('FETCH_FAILED', 'A API não devolveu o id do job.');
  return corpo.id;
}

/** Sentinela: o socket não conectou; o chamador cai para o polling. */
class WsIndisponivel extends Error {}

function erroDeCodigo(code: string | undefined, message?: string): ApiError {
  const c = (code ?? 'FETCH_FAILED') as CloneErrorCode;
  return new ApiError(c in MENSAGEM_POR_CODIGO ? c : 'FETCH_FAILED', message);
}

/** Abre o socket, entra na sala do job e resolve no evento `done`. */
function acompanharPorWebSocket(
  id: string,
  onProgress?: (progress: CloneProgress) => void,
): Promise<ResultadoInfo> {
  return new Promise<ResultadoInfo>((resolve, reject) => {
    const socket: Socket = io(API_URL, { transports: ['websocket'], timeout: 4000 });
    const encerrar = () => socket.disconnect();

    socket.on('connect', () => socket.emit('subscribe', id));
    socket.on('connect_error', () => {
      encerrar();
      reject(new WsIndisponivel());
    });

    socket.on('progress', (progress: CloneProgress) => onProgress?.(progress));
    socket.on('done', (result: ResultadoInfo) => {
      encerrar();
      resolve(result);
    });
    socket.on('failed', (erro: { code?: string; message?: string }) => {
      encerrar();
      reject(erroDeCodigo(erro.code, erro.message));
    });
  });
}

/** Reserva: pergunta o estado do job de tempo em tempo até terminar (ou falhar). */
async function acompanharPorPolling(
  id: string,
  onProgress?: (progress: CloneProgress) => void,
): Promise<ResultadoInfo> {
  const intervaloMs = 700;
  const limite = Date.now() + 5 * 60_000;

  while (Date.now() < limite) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/clone/${id}`);
    } catch {
      throw new ApiError('NETWORK');
    }
    if (!response.ok) throw erroDoCorpo(await lerJson(response), response.status);

    const status = (await lerJson(response)) as unknown as StatusResponse;
    if (status.progress) onProgress?.(status.progress);

    if (status.state === 'completed' && status.result) return status.result;
    if (status.state === 'failed') throw erroDeCodigo(status.error?.code, status.error?.message);

    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new ApiError('TIMEOUT', 'O clone demorou mais que o esperado.');
}

async function baixarZip(id: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/clone/${id}/download`);
  } catch {
    throw new ApiError('NETWORK');
  }
  if (!response.ok) throw erroDoCorpo(await lerJson(response), response.status);
  return response.blob();
}

export function baixarArquivo(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
