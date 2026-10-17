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
- [x] **Etapa 6** — fila com BullMQ + Redis. `POST /clone` devolve `{ id }`; `GET /clone/:id` dá
      estado + progresso; `GET /clone/:id/download` entrega o zip. O worker (`clone.worker.ts`)
      guarda o zip no disco temporário (`result-store.ts`) com validade e limpeza automática; o
      erro sai com código traduzido. *Pronto: teste confirma 10 clones ao mesmo tempo com um
      navegador só.* **Desvio do plano:** uma fila só, não duas. O teto de navegadores já é
      garantido pelo `BrowserService`; a concorrência da fila fica acima dele para o fetch não
      ficar preso atrás do render. Separar em duas filas fica para quando a fome de fetch aparecer
      de verdade. **`@nestjs/bullmq` foi descartado** (é ESM puro e não roda no projeto CommonJS);
      usamos `bullmq` direto, com a fila e o worker como providers do Nest.
- [x] **Etapa 7** — progresso por WebSocket, uma sala por job (`clone.gateway.ts`). O gateway ouve
      o `QueueEvents` do BullMQ (via Redis) e reemite `progress`/`done`/`failed` para a sala do
      `jobId`, então funciona mesmo com o worker em outro processo (Etapa 18). Quem conecta tarde
      recebe o estado atual na entrada. O front usa WebSocket com o polling de reserva se o socket
      não conectar. *Pronto: teste recebe progresso e resultado por socket, e o "conectar tarde".*
- [x] **Etapa 8** — interface: formulário, progresso por estágio, prévia em iframe, download e
      mensagem certa para cada erro. A prévia abre o zip no próprio navegador (JSZip), sem
      depender de armazenamento no servidor. Ajustada na Etapa 6 para o fluxo assíncrono
      (enfileira → acompanha → baixa).
- [x] **Extra (motor)** — descongelar animações de entrada (`freeze-animations.ts`): antes da
      captura, revela o conteúdo que ficaria preso em opacity:0 (AOS, WOW, scroll-reveal), para o
      clone não sair com seções em branco. Sites com efeito de JavaScript (carrossel, fundo 3D)
      continuam estáticos — isso é da natureza do clone-foto.
- [x] **Extra (front)** — tela de login no estilo Clone Ninja, com validação de e-mail. Ainda sem
      autenticação de verdade (qualquer e-mail válido entra); a lógica real fica para a Etapa 15.
- [x] **Etapa 9** — deploy: Dockerfile com imagem do Playwright, Railway, Redis, limite de
      requisições e health check. Aqui entra também a correção do DNS rebinding (fixar o IP já
      verificado na conexão). FEITO: deploy no Railway (Dockerfile) + Vercel, rate limit por IP, e amarração de IP no http-client (assertPublicHost devolve o IP aprovado; a conexão usa ele via dispatcher do undici).

## Fase 2 — Afiliado

- [~] **Etapa 10** — banco (Prisma + Postgres) e armazenamento dos zips fora do disco.
      **Metade A (banco) FEITA:** Postgres no docker-compose (porta 5433), Prisma 6 com a tabela
      `Clone`, o worker registra cada clone (sucesso e falha) via CloneRepository, endpoint
      GET /history. Degrada sozinho sem DATABASE_URL (produção segue sem histórico).
      **Metade B (armazenamento R2/S3) pendente** — resolve o disco efêmero dos zips.
- [x] **Etapa 11** — detectar checkout de Hotmart, Braip, Kiwify, Eduzz e Monetizze e sugerir a
      troca, em vez de exigir que o usuário saiba o link original. FEITO: peça do motor
      `checkout-detector.ts` (varre `<a href>` e `<form action>`, casa por domínio e extrai o código
      do produto), reportada em `CloneMeta.checkouts`. O front mostra os checkouts achados e o botão
      "Trocar" leva o link para o campo de troca; o afiliado só cola o link dele e reclona.
      Crescer a lista de plataformas é só adicionar uma entrada em `PLATFORMS`. 7 testes.
- [x] **Etapa 12** — pixels: achar Meta Pixel, GA4/GTM e TikTok, e trocar pelo ID do afiliado.
      FEITO: `pixel-detector.ts` acha Meta, GA4, GTM, TikTok e o UA legado (padrões com contexto:
      fbq, gtag, ttq.load, o domínio — nunca dígitos soltos), reportados em `CloneMeta.pixels`.
      `pixel-replacer.ts` troca o ID pelo do afiliado em `<script>` (inline e src), `<img>`,
      `<iframe>` e no texto do `<noscript>` do Meta. DTO ganhou `pixels: PixelRuleDto[]`. O front
      tem a seção "Pixels" e mostra os pixels achados com o botão "Trocar". 12 testes.
- [x] **Etapa 13** — editor simples: trocar texto, link e imagem, esconder bloco. Sem arrastar.
      FEITO (só no front): `editor.ts` liga por cima do iframe da prévia. Como o iframe é
      same-origin e SEM allow-scripts, o clone não roda JS e é o React, de fora, que escuta o
      clique e mexe no DOM (mais seguro e com um dono só). Ações: editar texto (contentEditable),
      trocar link (href do `<a>`), trocar imagem (URL ou upload → data URI) e esconder bloco (com
      desfazer). "Baixar editado" relê o HTML do iframe, restaura os caminhos assets/<hash>
      (blob: → caminho) e reempacota o zip (`reempacotarZip`). Comportamento de plataforma
      (clique capturado pelo pai, contentEditable sem allow-scripts, script do clone inerte)
      validado num harness no navegador.
- [ ] **Etapa 14** — histórico de clones.

## Fase 3 — Produto

- [~] **Etapa 15** — login (JWT + Passport) e cota por plano. **Modelo: login OPCIONAL** —
      clonar e pré-visualizar são livres; **baixar o zip e editar exigem conta** (funil freemium).
      **Backend FEITO:** tabela `User` (Prisma), `AuthModule` (register/login/me, bcrypt, JWT),
      `JwtStrategy` + `JwtAuthGuard`. O `GET /clone/:id/download` agora exige token. A prévia do
      anônimo vem de `GET /clone/:id/preview` (ABERTO): HTML autossuficiente montado no servidor
      pelo `preview-inliner.ts` a partir dos assets já em memória (o editor, same-origin, segue
      para quem baixou). Testado ponta a ponta (register/login/me, download 401 sem token / 200
      com token, preview 200 aberto). **Front FEITO:** `auth.ts` (register/login, token no
      localStorage), `Login.tsx` virou modal (entrar/criar conta) contra a API, topbar com
      e-mail/Sair. O clone não baixa mais sozinho: logado baixa o zip (same-origin, com editor);
      anônimo vê a prévia do backend e um CTA, com baixar/editar atrás do login. Validado ponta a
      ponta no navegador (anônimo → prévia servida; cadastro → download 200 + editor). **Falta
      só:** a cota por plano. **Login no ar FEITO** (Postgres no Railway + `DATABASE_URL`/`JWT_SECRET`;
      migração roda sozinha no start via Dockerfile).
- **Ajuste de UX + refactor (feature-based):** o front foi reorganizado em
      `shared/` (constants, utils, `api/client`+`api/errors`, `ui/`) e `features/`
      (auth, clone, editor, preview) com tipos por feature, API centralizada (nada de `fetch`
      solto nem URL exposta), hooks (`useAuth`, `useClone`, `useEditor`) e alias `@/`. Páginas:
      `/` (só URL + aceite — links/pixels saíram daqui), `/resultado` com **steps** na URL
      (`?step=1` prévia / `?step=2` configurar trocas — configurar depois de ver a detecção),
      `/editor` (edição em **tela cheia**, estilo Elementor), `/criar-conta` (cadastro + plano) e
      `/entrar`. Header com botão **"+ Novo clone"**; título sem estilo de link. Pagamento via
      Stripe fica na Etapa 16.
- [~] **Cota/plano (parte da Etapa 15):** campo `plano` ('free'/'pro') no `User`. **Free** baixa
      o zip COM marca d'água (selo injetado no `index.html` no download, via `watermark.ts`) e
      **não** tem editor; **Pro** baixa limpo e tem editor. O JWT carrega o plano; o front trava o
      botão Editar (cadeado) e mostra o upsell. **Vira Pro** só manualmente por enquanto (UPDATE no
      banco) — a cobrança automática é a Etapa 16. Falta a **cota de quantidade** (X clones/dia).
- [ ] **Etapa 16** — cobrança com Stripe (captura de cartão por Stripe Elements/Checkout; o
      número nunca passa pelo nosso servidor). Liga no botão de plano Pro e seta `plano='pro'`.
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
