/** Erros da API traduzidos para mensagens que o usuário entende. */

export type ApiErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_CONTENT'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'FETCH_FAILED'
  | 'RENDER_FAILED'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'SESSAO'
  | 'CAPTCHA'
  | 'SEM_CREDITO';

export const MENSAGEM_POR_CODIGO: Record<ApiErrorCode, string> = {
  INVALID_URL: 'Esse endereço não parece uma URL válida. Confira se começa com https://',
  BLOCKED_HOST: 'Esse endereço aponta para uma rede interna e foi bloqueado por segurança.',
  BLOCKED_CONTENT: 'O endereço não devolveu uma página HTML. É um PDF ou um arquivo?',
  TIMEOUT: 'O site demorou demais para responder. Tente de novo em instantes.',
  TOO_LARGE: 'A página passou do limite de tamanho permitido.',
  FETCH_FAILED: 'Não consegui acessar a página. Ela pode estar fora do ar ou bloqueando robôs.',
  RENDER_FAILED: 'Não consegui abrir a página no navegador interno.',
  RATE_LIMIT: 'Você atingiu o limite de clones por agora. Tente de novo mais tarde.',
  NETWORK: 'Não consegui falar com a API. O backend está rodando?',
  SESSAO: 'Sua sessão expirou. Entre de novo para baixar.',
  CAPTCHA: 'A verificação anti-robô falhou. Recarregue a página e tente de novo.',
  SEM_CREDITO: 'Você usou seus clones grátis do mês. Vire Pro para clonar mais.',
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly detail?: string;

  constructor(code: ApiErrorCode, detail?: string) {
    super(MENSAGEM_POR_CODIGO[code]);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
  }
}

/** Converte o corpo de erro da API num ApiError com a mensagem certa. */
export function erroDoCorpo(corpo: Record<string, unknown> | null, status: number): ApiError {
  const codigo = corpo?.code as ApiErrorCode | undefined;
  const msg = corpo?.message;
  const detalhe = Array.isArray(msg) ? msg.join(' ') : (msg as string | undefined);
  if (codigo && codigo in MENSAGEM_POR_CODIGO) return new ApiError(codigo, detalhe);
  return new ApiError('FETCH_FAILED', detalhe ?? `Erro ${status}`);
}

/** ApiError a partir de um código cru (ex.: evento de falha do WebSocket). */
export function erroDeCodigo(code: string | undefined, message?: string): ApiError {
  const c = (code ?? 'FETCH_FAILED') as ApiErrorCode;
  return new ApiError(c in MENSAGEM_POR_CODIGO ? c : 'FETCH_FAILED', message);
}
