import type { CloneProgress } from './clone.types';

/** Texto ninja de cada estágio do clone (overlay/progresso). */
export const TEXTO_ESTAGIO: Record<CloneProgress['stage'], string> = {
  fetching: 'Rastreando o alvo…',
  rendering: 'Revelando a página escondida…',
  downloading: 'Recolhendo os arquivos…',
  packaging: 'Selando o clone…',
};

/** Marcos fixos da barra de progresso por estágio (o download é a parte medível). */
export const MARCO_ESTAGIO: Record<CloneProgress['stage'], number> = {
  fetching: 8,
  rendering: 18,
  downloading: 20, // + proporção dos assets
  packaging: 96,
};
