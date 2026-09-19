# Clonador de Páginas

Clona páginas de venda **autorizadas** e devolve um `.zip` pronto para hospedar, com o link de
afiliado já trocado.

Projeto de estudo (JavaScript, React, NestJS, Playwright) que também é ferramenta de trabalho.

## Estrutura

```
back-clonador/    API NestJS — o motor de clonagem
front-clonador/   React + Vite — a interface
docker-compose.yml  Redis para a fila (Etapa 6)
PLANO.md          roadmap em etapas
```

O motor fica em `back-clonador/src/clone/engine/`, um arquivo por passo do pipeline:

| Arquivo | O que faz |
| --- | --- |
| `url-guard.ts` | Recusa URL que aponta para a rede interna (proteção contra SSRF) |
| `http-client.ts` | GET com tempo limite, limite de tamanho e redirecionamento checado a cada parada |
| `fetcher.ts` | Busca o HTML sem navegador |
| `render-detector.ts` | Decide se a página veio vazia e precisa de navegador |
| `html-rewriter.ts` | Lista os arquivos da página e aponta tudo para as cópias locais |
| `asset-downloader.ts` | Baixa os arquivos em paralelo, com limites |
| `link-replacer.ts` | Troca o link de checkout pelo link do afiliado |
| `packager.ts` | Monta o `.zip` |

`clone.service.ts` só orquestra esses passos.

## Rodando

Backend:

```bash
cd back-clonador && npm install && npm run dev
```

Frontend, noutro terminal:

```bash
cd front-clonador && npm install && npm run dev
```

Testes (sobem as páginas de teste sozinhos):

```bash
cd back-clonador && npm test
```

Páginas de teste no navegador, para olhar com os próprios olhos:

```bash
cd back-clonador && npm run fixtures
```

Ficam em `http://localhost:4173/ssr.html`, `/spa.html` e `/lazy.html`.

Redis (necessário para a fila, a partir da Etapa 6):

```bash
docker compose up -d
```

## Configuração

Copie `back-clonador/.env.example` para `.env`. A variável que mais importa é
`ALLOW_PRIVATE_HOSTS`: ela libera endereços de rede interna e existe **só** para as páginas de
teste rodarem em `127.0.0.1`. Em produção ela fica desligada — é o que impede alguém de usar a API
para acessar a sua rede por dentro.

## Usando a API

A API é assíncrona: você enfileira o clone, acompanha o estado e baixa o zip quando fica pronto.

1. Enfileirar (devolve `{ "id": "..." }`):

```bash
curl -X POST http://localhost:3000/clone -H "Content-Type: application/json" -d '{"url":"https://exemplo.com/oferta","acceptedTerms":true,"links":[{"from":"pay.hotmart.com/B12345678X","to":"https://go.hotmart.com/SEU-ID"}]}'
```

2. Acompanhar o estado e o progresso:

```bash
curl http://localhost:3000/clone/SEU_ID
```

Devolve `state` (`waiting`, `active`, `completed`, `failed`), `progress` (o estágio atual) e, no
fim, `result` com o resumo — ou `error` com o código traduzido.

3. Baixar o zip (`index.html`, `assets/` e `clone-info.json`), quando `completed`:

```bash
curl http://localhost:3000/clone/SEU_ID/download -o clone.zip
```

O zip fica disponível por um tempo (`RESULT_TTL_MS`, padrão 30 min) e depois é apagado.

## Termo de uso

A ferramenta é para clonar páginas que você tem autorização para clonar — as suas, e as que o
produtor liberou para o afiliado. Não serve para copiar página de terceiro sem permissão nem para
phishing. Por isso a API exige `acceptedTerms: true` em toda requisição.
