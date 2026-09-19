# Plano em etapas

Cada etapa tem um critério de pronto. Nada de "quase funcionando".

## Fase 0 — Base ✅

- [x] **Etapa 0** — esqueleto `back-clonador` + `front-clonador`, docker-compose com Redis,
      páginas de teste (fixtures) e o pipeline mínimo rodando ponta a ponta.
      *Pronto: a página de teste vira um zip que abre sem internet.*

## Fase 1 — MVP e eficiência

- [x] **Etapa 1** — motor dividido em módulos (`engine/`), com teste por peça.
- [x] **Etapa 2** — busca por HTTP simples com `undici` + trava de SSRF.
- [x] **Etapa 3** — detector de página vazia (`render-detector.ts`), ligado ao fallback da Etapa 4.
- [x] **Etapa 4** — Playwright como plano B (`renderer.ts` + `browser.service.ts`): um navegador
      reusado, contexto por job, bloqueio de imagem/mídia/fonte/analytics, rolagem para lazy load e
      remoção dos scripts de framework (`script-stripper.ts`). A trava de SSRF também vale dentro do
      navegador: cada requisição e cada redirecionamento do JavaScript da página é checado. O híbrido
      também tenta o navegador quando o fetch é recusado com cara de anti-robô (403, 429...).
- [x] **Etapa 5** — assets dentro do CSS (`css-assets.ts` + `asset-pipeline.ts`): segue `url()` e
      `@import` em cadeia, baixa fontes e fundos, e reescreve cada `.css` para caminhos locais.
      *Pronto: teste confirma o zip sem nenhuma referência local quebrada (sem 404).*
- [ ] **Etapa 6** — fila com BullMQ + Redis. `POST /clone` passa a devolver `{ jobId }`, o zip sai
      num endpoint de download e o resultado tem prazo de validade.
      *Pronto: 10 clones ao mesmo tempo nunca abrem mais que N navegadores.*
- [ ] **Etapa 7** — progresso por WebSocket, uma sala por job.
- [x] **Etapa 8** — interface: formulário, barra de progresso, prévia em iframe, download e
      mensagem certa para cada erro. A prévia abre o zip no próprio navegador (JSZip), sem
      depender de armazenamento no servidor; a barra é indeterminada até a Etapa 7.
- [ ] **Etapa 9** — deploy: Dockerfile com imagem do Playwright, Railway, Redis, limite de
      requisições e health check. Aqui entra também a correção do DNS rebinding (fixar o IP já
      verificado na conexão).

## Fase 2 — Afiliado

- [ ] **Etapa 10** — banco (Prisma + Postgres) e armazenamento dos zips fora do disco da máquina.
      Antecipado da Fase 3 porque histórico e editor não funcionam sem isso.
- [ ] **Etapa 11** — detectar checkout de Hotmart, Braip, Kiwify, Eduzz e Monetizze e sugerir a
      troca, em vez de exigir que o usuário saiba o link original.
- [ ] **Etapa 12** — pixels: achar Meta Pixel, GA4/GTM e TikTok, e trocar pelo ID do afiliado.
- [ ] **Etapa 13** — editor simples: trocar texto, link e imagem, esconder bloco. Sem arrastar.
- [ ] **Etapa 14** — histórico de clones.

## Fase 3 — Produto

- [ ] **Etapa 15** — login (JWT + Passport) e cota por plano.
- [ ] **Etapa 16** — cobrança com Stripe.
- [ ] **Etapa 17** — deploy de 1 clique na conta Vercel do usuário.
- [ ] **Etapa 18** — escala: worker separado da API, pool de navegadores, métricas.

## Decisões

- **Híbrido fetch-first.** Navegador é plano B, nunca o padrão. Motivo: custo de memória.
- **Descartado `jsdom`** — não dá conta de SPA moderno.
- **Descartado serviço de render gerenciado** (Browserless, ScrapingBee) — custo por requisição e
  dependência externa. Reavaliar só se a memória ficar cara.
- **Backend não vai para Vercel/Netlify** — serverless não combina com Playwright.
- **`p-limit` na versão 3.** A 5 em diante é ESM e não carrega no Nest em CommonJS.

## Riscos

- **Anti-bot.** User-Agent real já está no cliente HTTP; se apertar, entra modo stealth.
- **Memória.** Resolvida pelo trio híbrido + fila + reuso de navegador.
- **Legal.** Clonar só o que é autorizado. A API exige aceite do termo em toda requisição.
