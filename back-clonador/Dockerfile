# Backend do Clone Ninja: NestJS + Playwright + BullMQ.
#
# A imagem base é a MESMA versão do Playwright do package.json (1.63.0). Ela já vem com o
# Chromium e com as bibliotecas de sistema do Linux que o navegador precisa — é o que evita
# o erro "browser não encontrado" / libs faltando no servidor.
# Ao subir a versão do Playwright, troque a tag aqui também (têm que casar).

# ---------- build (compila o TypeScript) ----------
FROM mcr.microsoft.com/playwright:v1.63.0-jammy AS build
WORKDIR /app

# Instala TODAS as dependências (inclui as de desenvolvimento, para compilar).
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código e gera dist/.
COPY . .
RUN npm run build

# ---------- runtime (só o necessário para rodar) ----------
FROM mcr.microsoft.com/playwright:v1.63.0-jammy AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Só as dependências de produção.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Garante o Chromium para esta versão do Playwright. A imagem já o traz, mas rodar o install
# elimina qualquer dúvida de caminho (é idempotente). Não instala libs de SO — a imagem já tem.
RUN npx playwright install chromium

# Código já compilado, vindo do estágio de build.
COPY --from=build /app/dist ./dist

# O Railway injeta a porta em PORT; o app respeita process.env.PORT (padrão 3000).
EXPOSE 3000

CMD ["node", "dist/main"]
