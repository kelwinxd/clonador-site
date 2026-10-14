/** Tipos da feature de contas. */

export interface Sessao {
  token: string;
  email: string;
}

export type PlanoId = 'free' | 'pro';

export interface Plano {
  id: PlanoId;
  nome: string;
  preco: string;
  periodo?: string;
  descricao: string;
}
