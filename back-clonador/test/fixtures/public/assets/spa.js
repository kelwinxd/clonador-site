// Simula um SPA: o conteúdo só existe depois que o script roda.
setTimeout(function () {
  document.getElementById('root').innerHTML = [
    '<h1>Oferta Renderizada por JavaScript</h1>',
    '<p>Este texto não existe no HTML original. Só aparece com um navegador de verdade,',
    ' por isso serve para testar o fallback do Playwright.</p>',
    '<img src="/assets/produto.svg" alt="Produto" width="300" />',
    '<a class="botao" href="https://pay.exemplo-checkout.com/produto/XYZ789">Comprar</a>',
  ].join('');
}, 150);
