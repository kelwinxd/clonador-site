export type CloneErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_CONTENT'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'FETCH_FAILED'
  | 'RENDER_FAILED';

/** Erro do motor com código fixo: o controller traduz para status HTTP e o front mostra a mensagem certa. */
export class CloneError extends Error {
  constructor(
    readonly code: CloneErrorCode,
    message: string,
    /** Status HTTP quando a falha veio de uma resposta do site (403, 429...). */
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'CloneError';
  }
}
