/** Tipos da feature de contas. */

export interface Sessao {
  token: string;
  email: string;
  /** Plano do usuário: 'free' (marca d'água) ou 'pro'. */
  plano: string;
}

/** Estado dos créditos do ciclo. limite/restantes = null quando é Pro (ilimitado). */
export interface Creditos {
  plano: string;
  usados: number;
  limite: number | null;
  restantes: number | null;
}

export type PlanoId = 'free' | 'pro';

export interface Plano {
  id: PlanoId;
  nome: string;
  preco: string;
  periodo?: string;
  descricao: string;
}
