import type { Plano } from './auth.types';

/** Planos oferecidos no cadastro. O pagamento do Pro entra na Etapa 16 (Stripe). */
export const PLANOS: Plano[] = [
  {
    id: 'free',
    nome: 'Grátis',
    preco: 'R$ 0',
    descricao: "Clones com marca d'água e limite diário.",
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 29',
    periodo: '/mês',
    descricao: "Clones ilimitados, sem marca d'água, editor completo.",
  },
];
