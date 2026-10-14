import { API_URL } from '@/shared/constants';

/**
 * Cliente HTTP central. Todas as chamadas passam por aqui — os componentes e as features não
 * conhecem a URL base nem montam fetch na mão. Mantém a origem da API num lugar só.
 */

/** Monta a URL absoluta de um caminho da API (ex.: para o src de um iframe). */
export function apiUrl(caminho: string): string {
  return `${API_URL}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}

/** fetch com a base da API já aplicada. */
export function request(caminho: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(caminho), options);
}

/** POST com corpo JSON; devolve a Response crua (quem chama decide como ler). */
export function postJson(caminho: string, corpo: unknown, options?: RequestInit): Promise<Response> {
  return request(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    body: JSON.stringify(corpo),
    ...options,
  });
}

/** Lê o corpo como JSON sem explodir se vier vazio/inválido. */
export async function lerJson(resposta: Response): Promise<Record<string, unknown> | null> {
  return resposta.json().catch(() => null);
}
