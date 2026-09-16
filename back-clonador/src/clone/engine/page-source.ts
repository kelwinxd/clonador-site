/** Como o HTML foi obtido. 'render' só entra quando a página vem vazia no fetch. */
export type PageMode = 'fetch' | 'render';

export interface PageSource {
  html: string;
  /** URL final, depois dos redirecionamentos. É a base para resolver caminhos relativos. */
  finalUrl: string;
  mode: PageMode;
  /** Por que esse modo foi escolhido — vai para o log e para a resposta da API. */
  reason?: string;
}
