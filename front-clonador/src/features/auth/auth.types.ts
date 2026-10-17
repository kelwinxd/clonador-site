/** Tipos da feature de contas. */

export interface Sessao {
  token: string;
  email: string;
  /** Plano do usuário: 'free' (marca d'água, sem editor) ou 'pro'. */
  plano: string;
}

export type PlanoId = 'free' | 'pro';

export interface Plano {
  id: PlanoId;
  nome: string;
  preco: string;
  periodo?: string;
  descricao: string;
}
