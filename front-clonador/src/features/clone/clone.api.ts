import { io, type Socket } from 'socket.io-client';
import { apiUrl, lerJson, postJson, request } from '@/shared/api/client';
import { ApiError, erroDeCodigo, erroDoCorpo } from '@/shared/api/errors';
import { API_URL } from '@/shared/constants';
import type { CloneInfo, CloneMeta, CloneParams, CloneProgress } from './clone.types';

/** URL da prévia servida pelo backend (aberta, sem login) — usada no iframe do anônimo. */
export function urlPreview(id: string): string {
  return apiUrl(`/clone/${id}/preview`);
}

interface ResultadoInfo {
  fileName: string;
  meta: CloneMeta;
}

type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';

interface StatusResponse {
  id: string;
  state: JobState;
  progress: CloneProgress | null;
  result: { fileName: string; meta: CloneMeta } | null;
  error: { code: string; message: string } | null;
}

/**
 * Enfileira o clone e acompanha até terminar (WebSocket, com polling de reserva).
 * NÃO baixa o zip: o download é separado e exige conta (`baixarZip`).
 */
export async function cloneSite(
  params: CloneParams,
  token: string,
  onProgress?: (progress: CloneProgress) => void,
): Promise<CloneInfo> {
  const id = await enfileirar(params, token);
  const info = await acompanhar(id, onProgress);
  return { id, meta: info.meta, fileName: info.fileName };
}

async function enfileirar(params: CloneParams, token: string): Promise<string> {
  let resposta: Response;
  try {
    resposta = await postJson('/clone', params, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('NETWORK');
  }
  if (resposta.status === 401) throw new ApiError('SESSAO');
  if (resposta.status === 429) throw new ApiError('RATE_LIMIT');
  // 402 (sem crédito) e 403 (captcha) trazem { code } que o erroDoCorpo traduz.
  if (!resposta.ok) throw erroDoCorpo(await lerJson(resposta), resposta.status);
  const corpo = (await lerJson(resposta)) as { id?: string } | null;
  if (!corpo?.id) throw new ApiError('FETCH_FAILED', 'A API não devolveu o id do job.');
  return corpo.id;
}

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

/** Sentinela: o socket não conectou; o chamador cai para o polling. */
class WsIndisponivel extends Error {}

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

async function acompanharPorPolling(
  id: string,
  onProgress?: (progress: CloneProgress) => void,
): Promise<ResultadoInfo> {
  const intervaloMs = 700;
  const limite = Date.now() + 5 * 60_000;

  while (Date.now() < limite) {
    let resposta: Response;
    try {
      resposta = await request(`/clone/${id}`);
    } catch {
      throw new ApiError('NETWORK');
    }
    if (!resposta.ok) throw erroDoCorpo(await lerJson(resposta), resposta.status);

    const status = (await lerJson(resposta)) as unknown as StatusResponse;
    if (status.progress) onProgress?.(status.progress);
    if (status.state === 'completed' && status.result) return status.result;
    if (status.state === 'failed') throw erroDeCodigo(status.error?.code, status.error?.message);

    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new ApiError('TIMEOUT', 'O clone demorou mais que o esperado.');
}

/** Baixa o zip. Exige token (o endpoint é protegido). 401 vira erro de sessão. */
export async function baixarZip(id: string, token: string): Promise<Blob> {
  let resposta: Response;
  try {
    resposta = await request(`/clone/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  if (resposta.status === 401) throw new ApiError('SESSAO');
  if (!resposta.ok) throw erroDoCorpo(await lerJson(resposta), resposta.status);
  return resposta.blob();
}
