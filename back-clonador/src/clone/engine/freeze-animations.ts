import type { Page } from 'playwright';

/**
 * "Descongela" a página para o estado final antes da captura.
 *
 * O clone é uma foto estática e os scripts são removidos, então efeitos de "aparecer ao
 * rolar" (AOS, WOW, ScrollReveal e afins) deixariam o conteúdo preso em opacity:0 —
 * seções em branco no clone. Aqui a gente força esses elementos ao estado revelado.
 *
 * É conservador de propósito: só mexe em quem está invisível E parece um elemento de
 * animação de entrada (por atributo de biblioteca ou nome de classe). Assim não estraga
 * o que deve mesmo ficar escondido, como menus, modais e tooltips.
 */
export async function freezeAnimations(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      // 1. Bibliotecas conhecidas: aplica a classe/atributo de "já apareceu", para que o
      //    próprio CSS do site (que veio junto) leve o elemento ao estado final.
      document.querySelectorAll('[data-aos]').forEach((el) => el.classList.add('aos-animate'));
      document.querySelectorAll('.wow').forEach((el) => el.classList.add('animated'));
      document
        .querySelectorAll('[data-scroll], [data-animate], [data-sr]')
        .forEach((el) => el.classList.add('is-visible', 'in-view', 'revealed'));

      // 2. Rede de segurança: quem está invisível e tem cara de animação de entrada é
      //    forçado ao estado visível, sem animação nem transição.
      const marcadores = ['data-aos', 'data-scroll', 'data-animate', 'data-sr', 'data-reveal'];
      const padraoClasse = /\b(aos|wow|reveal|fade|slide-?in|animate|appear|scroll-?anim)/i;

      document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
        const estilo = getComputedStyle(el);
        const invisivel = parseFloat(estilo.opacity) === 0 || estilo.visibility === 'hidden';
        if (!invisivel) return;

        const classe = el.getAttribute('class') ?? '';
        const pareceAnimacao =
          marcadores.some((m) => el.hasAttribute(m)) || padraoClasse.test(classe);
        if (!pareceAnimacao) return;

        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('animation', 'none', 'important');
        el.style.setProperty('transition', 'none', 'important');
      });
    })
    .catch(() => undefined); // se a página fechar no meio, segue com o que tem
}
