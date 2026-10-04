import { CloneErrorCode } from './types';

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
